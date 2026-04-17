import { existsSync } from 'node:fs'
import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../constant/conflictConstant.js'
import { MergeDriver } from '../driver/MergeDriver.js'
import type { MergeConfig } from '../types/conflictTypes.js'

// Injected by esbuild --define at build time; in dev/test falls back.
declare const __VERSION__: string
// Injected by esbuild --define at build time; `typeof` guard keeps tests
// from triggering the main() invocation on module import.
declare const __BUNDLED__: boolean

const USAGE = `Usage: sf-git-merge-driver -O <ancestor> -A <local> -B <other> -P <output> [-L n] [-S tag] [-X tag] [-Y tag]

Flags:
  -O   ancestor file (required, must exist)
  -A   local/ours file (required, must exist; merged result is written back here)
  -B   other/theirs file (required, must exist)
  -P   output file (required, must exist; accepted per git contract)
  -L   conflict marker size (integer >= 1, default ${DEFAULT_CONFLICT_MARKER_SIZE})
  -S   ancestor conflict tag (default ${DEFAULT_ANCESTOR_CONFLICT_TAG})
  -X   local conflict tag (default ${DEFAULT_LOCAL_CONFLICT_TAG})
  -Y   other conflict tag (default ${DEFAULT_OTHER_CONFLICT_TAG})
  --version   Print version and exit
  --help      Show this message and exit
`

const USAGE_EXIT_CODE = 2
const CONFLICT_EXIT_CODE = 1
const SUCCESS_EXIT_CODE = 0

export function assertNodeVersion(versionString: string): void {
  const major = Number(versionString.split('.')[0])
  if (major < 20) {
    process.stderr.write(
      `sf-git-merge-driver requires Node.js >= 20 (got ${versionString})\n`
    )
    process.exit(USAGE_EXIT_CODE)
  }
}

export type ParsedArgs = {
  ancestorFile: string
  localFile: string
  otherFile: string
  outputFile: string
  config: MergeConfig
}

const FLAG_NAMES = new Set(['-O', '-A', '-B', '-P', '-L', '-S', '-X', '-Y'])

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const raw: Record<string, string | undefined> = {}
  let i = 0
  while (i < argv.length) {
    const flag = argv[i] as string
    if (!FLAG_NAMES.has(flag)) {
      throw new Error(`unknown argument: ${flag}`)
    }
    const value = argv[i + 1]
    if (value === undefined || FLAG_NAMES.has(value)) {
      throw new Error(`missing value for ${flag}`)
    }
    raw[flag] = value
    i += 2
  }

  const required = (flag: string): string => {
    const v = raw[flag]
    if (v === undefined) throw new Error(`missing required flag: ${flag}`)
    return v
  }
  const withFallback = (flag: string, fallback: string): string => {
    const v = raw[flag]
    return v === undefined || v === '' ? fallback : v
  }

  const ancestorFile = required('-O')
  const localFile = required('-A')
  const otherFile = required('-B')
  const outputFile = required('-P')

  const rawL = raw['-L']
  let conflictMarkerSize: number = DEFAULT_CONFLICT_MARKER_SIZE
  if (rawL !== undefined && rawL !== '') {
    const n = Number(rawL)
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`-L must be an integer >= 1 (got '${rawL}')`)
    }
    conflictMarkerSize = n
  }

  const config: MergeConfig = {
    conflictMarkerSize,
    ancestorConflictTag: withFallback('-S', DEFAULT_ANCESTOR_CONFLICT_TAG),
    localConflictTag: withFallback('-X', DEFAULT_LOCAL_CONFLICT_TAG),
    otherConflictTag: withFallback('-Y', DEFAULT_OTHER_CONFLICT_TAG),
  }

  return { ancestorFile, localFile, otherFile, outputFile, config }
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes('--version')) {
    const version = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'
    process.stdout.write(`${version}\n`)
    return SUCCESS_EXIT_CODE
  }
  if (argv.includes('--help')) {
    process.stdout.write(USAGE)
    return SUCCESS_EXIT_CODE
  }

  let parsed: ParsedArgs
  try {
    parsed = parseArgs(argv)
  } catch (err) {
    process.stderr.write(`sf-git-merge-driver: ${(err as Error).message}\n`)
    return USAGE_EXIT_CODE
  }

  const paths = [
    parsed.ancestorFile,
    parsed.localFile,
    parsed.otherFile,
    parsed.outputFile,
  ]
  for (const p of paths) {
    if (!existsSync(p)) {
      process.stderr.write(`sf-git-merge-driver: file not found: ${p}\n`)
      return USAGE_EXIT_CODE
    }
  }

  try {
    const driver = new MergeDriver(parsed.config)
    const hasConflict = await driver.mergeFiles(
      parsed.ancestorFile,
      parsed.localFile,
      parsed.otherFile
    )
    return hasConflict ? CONFLICT_EXIT_CODE : SUCCESS_EXIT_CODE
  } catch (err) {
    process.stderr.write(`sf-git-merge-driver: ${(err as Error).message}\n`)
    return CONFLICT_EXIT_CODE
  }
}

// Module top-level: run main() only when executed as a bundled script.
// esbuild sets __BUNDLED__ = true via --define. In tests, vi.stubGlobal +
// vi.resetModules + dynamic import exercises this block for full coverage.
if (typeof __BUNDLED__ !== 'undefined' && __BUNDLED__) {
  assertNodeVersion(process.versions.node)
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    err => {
      process.stderr.write(`sf-git-merge-driver: ${(err as Error).message}\n`)
      process.exit(CONFLICT_EXIT_CODE)
    }
  )
}
