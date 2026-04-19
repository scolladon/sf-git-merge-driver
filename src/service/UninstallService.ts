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
 *   - `restore-overwrite` re-parses the captured original raw line and
 *     replaces the current line with it, undoing an install-time
 *     overwrite. The paired `drop-line` for the annotation comment
 *     above is emitted by the planner and handled here uniformly.
 */
export const applyUninstallPlan = (
  lines: readonly Line[],
  plan: UninstallPlan
): Line[] => {
  const drop = new Set<number>()
  const rewrite = new Set<number>()
  const restore = new Map<number, string>()
  for (const action of plan.actions) {
    if (action.kind === 'drop-line') drop.add(action.lineIndex)
    else if (action.kind === 'remove-merge-attr') rewrite.add(action.lineIndex)
    else restore.set(action.lineIndex, action.originalRaw)
  }
  return lines.flatMap((line, index) => {
    if (drop.has(index)) return []
    const restoreRaw = restore.get(index)
    if (restoreRaw !== undefined) {
      // The planner rejects empty annotation bodies (see
      // GitAttributesPlanner.planUninstall), so `restoreRaw` always
      // has non-whitespace content here and parse yields ≥1 line.
      // If the contract ever breaks, fall back to keeping the
      // original line instead of writing undefined into the output.
      const restored = parse(restoreRaw).lines[0]
      return restored ? [restored] : [line]
    }
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
