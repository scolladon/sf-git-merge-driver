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
  type ParsedFile,
  parse,
  serialise,
} from '../utils/gitAttributesFile.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { type InstallPlan, planInstall } from './GitAttributesPlanner.js'

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
const DRIVER_COMMAND =
  `sh -c 'node "${BINARY_PATH}" -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -S "$6" -X "$7" -Y "$8"'` +
  ' -- %O %A %B %P %L %S %X %Y'

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

export class InstallService {
  @log('InstallService')
  public async installMergeDriver(): Promise<InstallPlan> {
    const git = simpleGit({ unsafe: { allowUnsafeMergeDriver: true } })
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(`merge.${DRIVER_NAME}.driver`, DRIVER_COMMAND)

    const gitAttributesPath = await getGitAttributesPath()
    const raw = await readAttributesOrEmpty(gitAttributesPath)
    const parsed = parse(raw)
    const plan = planInstall(parsed, DESIRED_PATTERNS)

    const conflicts = plan.actions.flatMap(action =>
      action.kind === 'conflict'
        ? [{ pattern: action.pattern, existingDriver: action.existingDriver }]
        : []
    )
    if (conflicts.length > 0) throw new InstallConflictError(conflicts)

    // Apply the plan: drop duplicates, then append new rules.
    const dedup = new Set(plan.dedupDrops)
    const kept = parsed.lines.flatMap((line, index) =>
      dedup.has(index) ? [] : [line]
    )
    let next: ParsedFile = { ...parsed, lines: kept }
    for (const action of plan.actions) {
      if (action.kind !== 'add') continue
      next = addRule(next, action.pattern, [['merge', DRIVER_NAME]])
    }

    // Skip the write if the file is already in the desired state —
    // saves an I/O and keeps timestamps stable for tooling.
    const after = serialise(next)
    if (after !== raw) {
      await writeFile(gitAttributesPath, after)
    }

    return plan
  }
}
