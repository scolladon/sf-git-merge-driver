import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../constant/metadataConstant.js'
import {
  addRule,
  type Line,
  type ParsedFile,
  parse,
  type RuleLine,
  ruleWithAttr,
  serialise,
} from '../utils/gitAttributesFile.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import {
  type ConflictPolicy,
  type InstallPlan,
  OVERWRITE_ANNOTATION_PREFIX,
  planInstall,
} from './GitAttributesPlanner.js'

// Resolved from this compiled module's location:
//   <plugin-root>/lib/service/InstallService.js → ../../bin/merge-driver.cjs
const BINARY_RELATIVE = ['..', '..', 'bin', 'merge-driver.cjs'] as const
const BINARY_PATH_RAW = join(
  dirname(fileURLToPath(import.meta.url)),
  ...BINARY_RELATIVE
)

// Ensure POSIX separators (Windows join() uses backslash) and escape both
// single and double quotes so the path embeds safely inside the
// `sh -c '…"…"…'` double-quoted context.
const BINARY_PATH = BINARY_PATH_RAW.replace(/\\/g, '/')
  .replace(/\$/g, '\\$')
  .replace(/`/g, '\\`')
  .replace(/"/g, '\\"')
  .replace(/'/g, "'\\''")

// git's merge-driver placeholder convention: %O ancestor, %A local, %B other,
// %P output, %L conflict-marker-size, %S ancestor-label, %X local-label,
// %Y other-label. All 8 are passed — this wires %S (new) through to the
// binary's -S flag; previous install omitted %S, forcing the static default.
export const DRIVER_COMMAND =
  `sh -c 'node "${BINARY_PATH}" -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -S "$6" -X "$7" -Y "$8"'` +
  ' -- %O %A %B %P %L %S %X %Y'

export const DRIVER_NAME_CONFIG_VALUE = 'Salesforce source merge driver'

const DESIRED_PATTERNS: readonly string[] = [
  ...METADATA_TYPES_PATTERNS.map(p => `*.${p}-meta.xml`),
  ...MANIFEST_PATTERNS,
]

/** Error thrown when the plan contains conflicts and policy is 'abort'. */
export class InstallConflictError extends Error {
  public readonly conflicts: readonly {
    readonly pattern: string
    readonly existingDriver: string
  }[]

  constructor(
    conflicts: readonly {
      pattern: string
      existingDriver: string
    }[]
  ) {
    const lines = conflicts.map(
      c => `  ${c.pattern} is already owned by merge=${c.existingDriver}`
    )
    super(
      `Installation aborted: ${conflicts.length} pattern(s) already configured ` +
        `with a different merge driver.\n${lines.join('\n')}`
    )
    this.name = 'InstallConflictError'
    this.conflicts = conflicts
  }
}

export type InstallOptions = {
  /**
   * When true, plan the install and return the plan without touching
   * `.git/config` or `.git/info/attributes`. The returned plan may
   * contain `conflict` actions — the command layer is responsible for
   * formatting them for the user; no `InstallConflictError` is thrown.
   */
  readonly dryRun?: boolean
  /**
   * How to handle patterns already owned by another merge driver.
   * Default 'abort' (throw InstallConflictError); 'skip' leaves the
   * user's line alone and does not add ours; 'overwrite' replaces the
   * user's line with ours and inserts an annotation comment so the
   * subsequent uninstall can restore the prior driver.
   */
  readonly onConflict?: ConflictPolicy
}

export type InstallOutcome = {
  readonly plan: InstallPlan
  readonly dryRun: boolean
  /** True when writeFile was called on the attributes file. */
  readonly wroteAttributes: boolean
  readonly gitAttributesPath: string
}

/**
 * Read `.git/info/attributes` best-effort: a missing file is equivalent
 * to an empty one. Any other I/O error propagates.
 */
const readAttributesOrEmpty = async (path: string): Promise<string> => {
  try {
    return await readFile(path, { encoding: 'utf8' })
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return ''
    }
    throw err
  }
}

/**
 * Apply an install plan to the parsed file:
 *   - Drop dedup lines.
 *   - For each `overwrite` action, replace the existing rule line with
 *     our driver AND insert an annotation comment above it carrying the
 *     original raw, so uninstall can restore.
 *   - For each `add` action, append a new rule at the end.
 *   - `skip` and `skip-conflict` are no-ops for the file — either we
 *     already own the pattern, or we deliberately defer to the existing
 *     driver.
 */
const applyInstallPlan = (
  parsed: ParsedFile,
  plan: InstallPlan
): ParsedFile => {
  const dedup = new Set(plan.dedupDrops)
  const overwrites = new Map<
    number,
    Extract<(typeof plan.actions)[number], { kind: 'overwrite' }>
  >()
  for (const action of plan.actions) {
    if (action.kind === 'overwrite') overwrites.set(action.lineIndex, action)
  }

  const rewrittenLines: Line[] = []
  for (let i = 0; i < parsed.lines.length; i++) {
    if (dedup.has(i)) continue
    const existing = parsed.lines[i]
    const overwrite = overwrites.get(i)
    if (!overwrite) {
      rewrittenLines.push(existing)
      continue
    }
    // Insert annotation comment above the rewritten rule. The planner
    // only emits `overwrite` for rule lines (see planInstall), so the
    // cast here is a contract narrowing rather than an assumption.
    const annotation: Line = {
      kind: 'comment',
      raw: `${OVERWRITE_ANNOTATION_PREFIX}${overwrite.originalRaw}`,
    }
    const withOurDriver: Line = ruleWithAttr(
      existing as RuleLine,
      'merge',
      DRIVER_NAME
    )
    rewrittenLines.push(annotation, withOurDriver)
  }

  let next: ParsedFile = { ...parsed, lines: rewrittenLines }
  for (const action of plan.actions) {
    if (action.kind !== 'add') continue
    next = addRule(next, action.pattern, [['merge', DRIVER_NAME]])
  }
  return next
}

export class InstallService {
  @log('InstallService')
  public async installMergeDriver(
    options: InstallOptions = {}
  ): Promise<InstallOutcome> {
    const dryRun = options.dryRun ?? false
    const policy: ConflictPolicy = options.onConflict ?? 'abort'

    // Plan first — reading the file and diffing against the desired
    // pattern set is side-effect free, so we can do it up front and
    // bail early for dry-run before touching git config.
    const gitAttributesPath = await getGitAttributesPath()
    const raw = await readAttributesOrEmpty(gitAttributesPath)
    const parsed = parse(raw)
    const plan = planInstall(parsed, DESIRED_PATTERNS, policy)

    if (dryRun) {
      return { plan, dryRun: true, wroteAttributes: false, gitAttributesPath }
    }

    // `conflict` actions only appear when policy === 'abort'; for
    // 'skip' they become `skip-conflict`, for 'overwrite' they become
    // `overwrite`. Surfacing them before any write keeps the abort
    // policy strictly non-destructive.
    const conflicts = plan.actions.flatMap(action =>
      action.kind === 'conflict'
        ? [{ pattern: action.pattern, existingDriver: action.existingDriver }]
        : []
    )
    if (conflicts.length > 0) throw new InstallConflictError(conflicts)

    // git config goes first so the merge driver is defined before any
    // attribute rule references it.
    const git = simpleGit({ unsafe: { allowUnsafeMergeDriver: true } })
    await git.addConfig(`merge.${DRIVER_NAME}.name`, DRIVER_NAME_CONFIG_VALUE)
    await git.addConfig(`merge.${DRIVER_NAME}.driver`, DRIVER_COMMAND)

    // Apply plan and write attributes file only if the result differs
    // from what was read — saves an I/O and keeps timestamps stable.
    const next = applyInstallPlan(parsed, plan)
    const after = serialise(next)
    const wroteAttributes = after !== raw
    if (wroteAttributes) {
      await writeFile(gitAttributesPath, after)
    }

    return { plan, dryRun: false, wroteAttributes, gitAttributesPath }
  }
}
