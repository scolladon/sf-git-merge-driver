import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  getMerge,
  type ParsedFile,
  type RuleLine,
} from '../utils/gitAttributesFile.js'

/**
 * An action in an uninstall plan — what to do with a single line of
 * `.git/info/attributes`. Plans are applied by `UninstallService`, and
 * the shape is also what `--dry-run` renders to the user.
 *
 * `drop-line` is safe (line is pure `<pattern> merge=salesforce-source`
 * or equivalent); `remove-merge-attr` is the A8 fix — keep the user's
 * other attributes on the line and only strip our `merge=` token.
 */
export type UninstallAction =
  | { readonly kind: 'drop-line'; readonly lineIndex: number }
  | { readonly kind: 'remove-merge-attr'; readonly lineIndex: number }

export type UninstallPlan = {
  readonly actions: readonly UninstallAction[]
}

/**
 * Walk every rule in the parsed file; for rules whose `merge=` attribute
 * matches our driver, emit the appropriate action. Comments, blanks, and
 * rules for other merge drivers are ignored (no action).
 */
export const planUninstall = (file: ParsedFile): UninstallPlan => {
  const actions: UninstallAction[] = []
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'rule') continue
    if (getMerge(line) !== DRIVER_NAME) continue
    // Rule mentions our driver. If the only attribute is our merge, the
    // whole line can be dropped safely; otherwise the user has other
    // attributes on the same line and we must preserve them by keeping
    // the line and removing only the merge token.
    if (line.attrs.size === 1) {
      actions.push({ kind: 'drop-line', lineIndex: i })
    } else {
      actions.push({ kind: 'remove-merge-attr', lineIndex: i })
    }
  }
  return { actions }
}

/**
 * Conflict policy for `planInstall`.
 *   - `abort`: conflicts appear in the plan as `conflict` actions; the
 *     service refuses to write and surfaces the list to the user.
 *   - `skip`: (deferred — step 5) no-op for the conflicting pattern.
 *   - `overwrite`: (deferred — step 5) rewrite the user's line with our
 *     driver and an annotation comment for uninstall-time restore.
 */
export type ConflictPolicy = 'abort' | 'skip' | 'overwrite'

/**
 * An action in an install plan. Unlike uninstall, install actions do
 * not all carry a `lineIndex` — new rules that don't exist in the file
 * yet have no source line, and `add` is the planner's way of saying
 * "append this pattern at the end".
 */
export type InstallAction =
  | { readonly kind: 'add'; readonly pattern: string }
  | {
      readonly kind: 'skip'
      readonly pattern: string
      readonly lineIndex: number
    }
  | {
      readonly kind: 'conflict'
      readonly pattern: string
      readonly existingDriver: string
      readonly lineIndex: number
    }

export type InstallPlan = {
  readonly actions: readonly InstallAction[]
  /**
   * Line indices that are exact duplicates of an already-counted
   * `skip`. Dropped silently during apply — healing for files left
   * with duplicates by the pre-plan install path (or manual edits).
   */
  readonly dedupDrops: readonly number[]
}

/** Internal helper: index every rule by pattern for O(1) lookups. */
const indexRulesByPattern = (
  file: ParsedFile
): Map<string, { index: number; rule: RuleLine }[]> => {
  const byPattern = new Map<string, { index: number; rule: RuleLine }[]>()
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'rule') continue
    const existing = byPattern.get(line.pattern)
    if (existing) existing.push({ index: i, rule: line })
    else byPattern.set(line.pattern, [{ index: i, rule: line }])
  }
  return byPattern
}

/**
 * Decide, for each desired pattern, whether we already own it (skip),
 * someone else owns it (conflict), or it's absent (add). Deduplicate
 * any redundant copies of our own rule as a silent healing pass.
 *
 * Step 5 will add a `policy: ConflictPolicy` argument and change the
 * shape of the plan when policy is 'skip' or 'overwrite'. For now the
 * planner always returns conflict actions as-is and the service throws.
 */
export const planInstall = (
  file: ParsedFile,
  desiredPatterns: readonly string[]
): InstallPlan => {
  const byPattern = indexRulesByPattern(file)
  const actions: InstallAction[] = []
  const dedupDrops: number[] = []

  for (const pattern of desiredPatterns) {
    const matches = byPattern.get(pattern) ?? []
    const oursFirst = matches.find(m => getMerge(m.rule) === DRIVER_NAME)
    if (oursFirst) {
      actions.push({ kind: 'skip', pattern, lineIndex: oursFirst.index })
      for (const extra of matches) {
        if (extra.index === oursFirst.index) continue
        if (getMerge(extra.rule) !== DRIVER_NAME) continue
        dedupDrops.push(extra.index)
      }
      continue
    }
    const otherFirst = matches.find(m => {
      const merge = getMerge(m.rule)
      return typeof merge === 'string' && merge !== DRIVER_NAME
    })
    if (otherFirst) {
      const existingDriver = getMerge(otherFirst.rule) as string
      actions.push({
        kind: 'conflict',
        pattern,
        existingDriver,
        lineIndex: otherFirst.index,
      })
      continue
    }
    actions.push({ kind: 'add', pattern })
  }

  return { actions, dedupDrops }
}
