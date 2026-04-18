import { readFile, writeFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  type Line,
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

export class UninstallService {
  @log('UninstallService')
  public async uninstallMergeDriver(): Promise<void> {
    const git = simpleGit()
    try {
      // Throws when the merge driver is not installed
      await git.raw(['config', '--remove-section', `merge.${DRIVER_NAME}`])
    } catch (error) {
      Logger.error(
        'Merge driver uninstallation failed to cleanup git config',
        error
      )
    }

    try {
      const gitAttributesPath = await getGitAttributesPath()
      // Throws when the file does not exist
      const raw = await readFile(gitAttributesPath, { encoding: 'utf8' })
      const parsed = parse(raw)
      const plan = planUninstall(parsed)
      if (plan.actions.length === 0) return
      const nextLines = applyUninstallPlan(parsed.lines, plan)
      await writeFile(
        gitAttributesPath,
        serialise({ ...parsed, lines: nextLines })
      )
    } catch (error) {
      Logger.error(
        'Merge driver uninstallation failed to cleanup git attributes',
        error
      )
    }
  }
}
