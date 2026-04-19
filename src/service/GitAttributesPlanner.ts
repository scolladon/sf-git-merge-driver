import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  getMerge,
  type ParsedFile,
  type RuleLine,
} from '../utils/gitAttributesFile.js'

/**
 * Prefix that marks a comment line recording the original driver we
 * replaced during an `--on-conflict=overwrite` install. `uninstall`
 * parses this prefix to restore the prior driver's rule line.
 *
 * Shape: `# sf-git-merge-driver overwrote: <original raw line>`
 */
export const OVERWRITE_ANNOTATION_PREFIX = '# sf-git-merge-driver overwrote: '

/**
 * An action in an uninstall plan — what to do with a single line of
 * `.git/info/attributes`. Plans are applied by `UninstallService`, and
 * the shape is also what `--dry-run` renders to the user.
 *
 * `drop-line` is safe (line is pure `<pattern> merge=salesforce-source`
 * or equivalent); `remove-merge-attr` is the A8 fix — keep the user's
 * other attributes on the line and only strip our `merge=` token;
 * `restore-overwrite` reverts an install-time overwrite by writing the
 * original raw line back (paired with a `drop-line` for the annotation
 * comment above it).
 */
export type UninstallAction =
  | { readonly kind: 'drop-line'; readonly lineIndex: number }
  | { readonly kind: 'remove-merge-attr'; readonly lineIndex: number }
  | {
      readonly kind: 'restore-overwrite'
      readonly lineIndex: number
      readonly originalRaw: string
    }

export type UninstallPlan = {
  readonly actions: readonly UninstallAction[]
}

/**
 * Walk every rule in the parsed file; for rules whose `merge=` attribute
 * matches our driver, emit the appropriate action. Comments, blanks, and
 * rules for other merge drivers are ignored (no action).
 *
 * Additionally, an annotation comment of the form
 * `# sf-git-merge-driver overwrote: <raw>` immediately above one of our
 * rule lines triggers `restore-overwrite` — the rule is replaced with
 * the captured raw, and the annotation comment is dropped.
 */
export const planUninstall = (file: ParsedFile): UninstallPlan => {
  const actions: UninstallAction[] = []
  // Loop counter advances strictly — no need to skip over already-queued
  // annotation-drops because we only look backwards (i - 1) to detect
  // them, and the annotation line itself is a comment, not a rule, so
  // it never enters the rule-handling branches.
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'rule') continue
    if (getMerge(line) !== DRIVER_NAME) continue

    // Check for an overwrite annotation on the preceding line.
    // `file.lines[-1]` is undefined in JS, so no explicit bounds
    // check needed — the `prev?.kind === 'comment'` gate below
    // handles both "missing" and "wrong kind" with one expression.
    //
    // Empty annotation bodies (`# sf-git-merge-driver overwrote: `
    // with nothing after) are ignored — writing an empty rule back
    // would corrupt the file. The annotation is treated as an
    // ordinary comment in that case, and the driver rule falls
    // through to the standard drop-line / remove-merge-attr path.
    const prev = file.lines[i - 1]
    if (
      prev?.kind === 'comment' &&
      prev.raw.startsWith(OVERWRITE_ANNOTATION_PREFIX)
    ) {
      const originalRaw = prev.raw.slice(OVERWRITE_ANNOTATION_PREFIX.length)
      if (originalRaw.trim().length > 0) {
        actions.push({ kind: 'drop-line', lineIndex: i - 1 })
        actions.push({ kind: 'restore-overwrite', lineIndex: i, originalRaw })
        continue
      }
    }

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
 *   - `skip`: planner emits `skip-conflict` — the service leaves the
 *     user's line untouched and does NOT add our driver for that glob.
 *   - `overwrite`: planner emits `overwrite` — the service replaces the
 *     user's line with our driver and inserts an annotation comment so
 *     uninstall can restore.
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
  | {
      readonly kind: 'skip-conflict'
      readonly pattern: string
      readonly existingDriver: string
      readonly lineIndex: number
    }
  | {
      readonly kind: 'overwrite'
      readonly pattern: string
      readonly existingDriver: string
      readonly lineIndex: number
      /** Full raw text of the user's original rule line — used to
       *  build the annotation comment so uninstall can restore. */
      readonly originalRaw: string
    }

/** A diagnostic a planner surfaces on the install path so the command
 *  layer can log a warning without altering the attributes file. */
export type PatternDiagnostic = {
  readonly pattern: string
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
  /**
   * Patterns where a `-text` (text=false) attribute is set on the
   * same glob, which makes git treat matching files as binary and
   * completely bypass any merge driver. Install still proceeds, but
   * our driver will be silently inactive on these patterns until the
   * user removes `-text`. No auto-fix — user decides.
   */
  readonly textAttributeWarnings: readonly PatternDiagnostic[]
  /**
   * Patterns with a commented-out driver line
   * (`# *.profile-meta.xml merge=salesforce-source`). The user
   * explicitly disabled the driver at some point; install still adds
   * a live rule (so the driver works) but the command layer is told
   * so it can surface a warning.
   */
  readonly commentedOutWarnings: readonly PatternDiagnostic[]
}

/** Internal helper: index every rule by pattern for O(1) lookups.
 *  Returns a ReadonlyMap of readonly arrays — callers must not mutate.
 *  The map is built locally and never escapes the planner module, so
 *  this is a defensive typing rather than a runtime concern. */
const indexRulesByPattern = (
  file: ParsedFile
): ReadonlyMap<string, readonly { index: number; rule: RuleLine }[]> => {
  const byPattern = new Map<string, { index: number; rule: RuleLine }[]>()
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'rule') continue
    const existing = byPattern.get(line.pattern)
    // Rebuild rather than mutate: aligns with the project's immutable
    // data convention. The extra copy is bounded by duplicates of the
    // same pattern in the file (typically 0 or 1).
    byPattern.set(
      line.pattern,
      existing
        ? [...existing, { index: i, rule: line }]
        : [{ index: i, rule: line }]
    )
  }
  return byPattern
}

/**
 * Detect commented-out driver lines of the form:
 *   `# *.profile-meta.xml merge=salesforce-source`
 * with optional leading whitespace. Matches for any of our desired
 * patterns only.
 */
const detectCommentedOutDriverLines = (
  file: ParsedFile,
  desiredPatterns: ReadonlySet<string>
): PatternDiagnostic[] => {
  const diagnostics: PatternDiagnostic[] = []
  const expectedSuffix = ` merge=${DRIVER_NAME}`
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'comment') continue
    // Comment lines always start with `#` (optionally preceded by
    // whitespace), followed optionally by more whitespace. `trim`
    // collapses both ends, then we drop the `#` prefix and any
    // whitespace following it in one pass.
    const body = line.raw.trim().replace(/^#\s*/, '')
    if (!body.endsWith(expectedSuffix)) continue
    const pattern = body.slice(0, -expectedSuffix.length).trim()
    if (!desiredPatterns.has(pattern)) continue
    diagnostics.push({ pattern, lineIndex: i })
  }
  return diagnostics
}

const actionForConflict = (
  pattern: string,
  lineIndex: number,
  rule: RuleLine,
  existingDriver: string,
  policy: ConflictPolicy
): InstallAction => {
  if (policy === 'skip') {
    return { kind: 'skip-conflict', pattern, existingDriver, lineIndex }
  }
  if (policy === 'overwrite') {
    return {
      kind: 'overwrite',
      pattern,
      existingDriver,
      lineIndex,
      originalRaw: rule.raw,
    }
  }
  return { kind: 'conflict', pattern, existingDriver, lineIndex }
}

/**
 * Decide, for each desired pattern, whether we already own it (skip),
 * someone else owns it (conflict / skip-conflict / overwrite), or it's
 * absent (add). Deduplicate redundant copies of our own rule silently.
 *
 * Policy changes only the conflict branch — patterns without competing
 * drivers behave the same regardless of policy.
 */
export const planInstall = (
  file: ParsedFile,
  desiredPatterns: readonly string[],
  policy: ConflictPolicy = 'abort'
): InstallPlan => {
  const byPattern = indexRulesByPattern(file)
  const desiredSet = new Set(desiredPatterns)
  const actions: InstallAction[] = []
  const dedupDrops: number[] = []
  const textAttributeWarnings: PatternDiagnostic[] = []

  for (const pattern of desiredPatterns) {
    const matches = byPattern.get(pattern) ?? []
    // `-text` on any rule with this pattern (regardless of whether
    // that rule mentions a merge driver) makes git treat matching
    // files as binary — our driver will never fire. Emit one warning
    // per (pattern, line) pair.
    for (const match of matches) {
      if (match.rule.attrs.get('text') === false) {
        textAttributeWarnings.push({ pattern, lineIndex: match.index })
      }
    }
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
    // `oursFirst` is guaranteed falsy at this point (continue above
    // otherwise), so any rule with a string merge= on this pattern
    // is by definition a different driver. Capture the driver name
    // via an explicit narrowing loop instead of a cast — keeps the
    // type contract sound without relying on `.find` predicate
    // narrowing (which TS doesn't thread through chained calls).
    let otherMatch:
      | { index: number; rule: RuleLine; existingDriver: string }
      | undefined
    for (const m of matches) {
      const existingDriver = getMerge(m.rule)
      if (typeof existingDriver === 'string') {
        otherMatch = { index: m.index, rule: m.rule, existingDriver }
        break
      }
    }
    if (otherMatch) {
      actions.push(
        actionForConflict(
          pattern,
          otherMatch.index,
          otherMatch.rule,
          otherMatch.existingDriver,
          policy
        )
      )
      continue
    }
    actions.push({ kind: 'add', pattern })
  }

  const commentedOutWarnings = detectCommentedOutDriverLines(file, desiredSet)

  return {
    actions,
    dedupDrops,
    textAttributeWarnings,
    commentedOutWarnings,
  }
}
