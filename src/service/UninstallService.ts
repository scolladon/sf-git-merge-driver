import { readFile, writeFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  type Line,
  type ParsedFile,
  parse,
  ruleWithoutAttr,
  serialise,
} from '../utils/gitAttributesFile.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'
import { planUninstall, type UninstallPlan } from './GitAttributesPlanner.js'

/**
 * Apply an uninstall plan to a line list:
 *   - `drop-line` removes the line entirely.
 *   - `remove-merge-attr` rewrites the rule line via `ruleWithoutAttr`,
 *     stripping only the `merge=<our-driver>` token and re-serialising
 *     the raw so the user's other attributes survive (A8 data-loss fix).
 */
const applyUninstallPlan = (
  lines: readonly Line[],
  plan: UninstallPlan
): Line[] => {
  const drop = new Set<number>()
  const rewrite = new Set<number>()
  for (const action of plan.actions) {
    if (action.kind === 'drop-line') drop.add(action.lineIndex)
    else rewrite.add(action.lineIndex)
  }
  return lines.flatMap((line, index) => {
    if (drop.has(index)) return []
    if (!rewrite.has(index) || line.kind !== 'rule') return [line]
    return [ruleWithoutAttr(line, 'merge')]
  })
}

export type UninstallOptions = {
  /**
   * When true, plan the uninstall and return the plan without touching
   * `.git/config` or `.git/info/attributes`.
   */
  readonly dryRun?: boolean
}

export type UninstallOutcome = {
  readonly plan: UninstallPlan
  readonly dryRun: boolean
  readonly wroteAttributes: boolean
  readonly removedConfigSection: boolean
  readonly gitAttributesPath: string | undefined
}

export class UninstallService {
  @log('UninstallService')
  public async uninstallMergeDriver(
    options: UninstallOptions = {}
  ): Promise<UninstallOutcome> {
    const dryRun = options.dryRun ?? false

    let removedConfigSection = false
    if (!dryRun) {
      const git = simpleGit()
      try {
        // Throws when the merge driver is not installed
        await git.raw(['config', '--remove-section', `merge.${DRIVER_NAME}`])
        removedConfigSection = true
      } catch (error) {
        Logger.error(
          'Merge driver uninstallation failed to cleanup git config',
          error
        )
      }
    }

    let gitAttributesPath: string | undefined
    let plan: UninstallPlan = { actions: [] }
    let wroteAttributes = false
    try {
      gitAttributesPath = await getGitAttributesPath()
      // Throws when the file does not exist
      const raw = await readFile(gitAttributesPath, { encoding: 'utf8' })
      const parsed: ParsedFile = parse(raw)
      plan = planUninstall(parsed)
      if (plan.actions.length > 0 && !dryRun) {
        const nextLines = applyUninstallPlan(parsed.lines, plan)
        await writeFile(
          gitAttributesPath,
          serialise({ ...parsed, lines: nextLines })
        )
        wroteAttributes = true
      }
    } catch (error) {
      Logger.error(
        'Merge driver uninstallation failed to cleanup git attributes',
        error
      )
    }

    return {
      plan,
      dryRun,
      wroteAttributes,
      removedConfigSection,
      gitAttributesPath,
    }
  }
}
