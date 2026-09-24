import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { PassThrough, type Writable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import type { MergeConfig } from '../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'
import {
  buildParitySnapshot,
  type ParityParser,
} from '../utils/parserParity.js'
import {
  type FixtureSize,
  generateProfileFixtures,
} from './fixtures/generateFixtures.js'

// ---- CLI ----

const PHASES = [
  'parse',
  'merge',
  'pipeline',
  'rss',
  'binary',
  'snapshot',
] as const
type Phase = (typeof PHASES)[number]
type PairedPhase = Exclude<Phase, 'snapshot'>

const TIER_VALUES: readonly FixtureSize[] = ['medium', 'large', 'xl']
const MIN_ROUNDS = 15
const DEFAULT_ROUNDS = 15
const USAGE_EXIT_CODE = 2

interface CliOptions {
  readonly base: string
  readonly phase: Phase
  readonly tiers: readonly FixtureSize[]
  readonly rounds: number
  readonly expectGain: number | undefined
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

function usageError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(USAGE_EXIT_CODE)
}

const isPhase = (value: string): value is Phase =>
  (PHASES as readonly string[]).includes(value)

const isTier = (value: string): value is FixtureSize =>
  (TIER_VALUES as readonly string[]).includes(value)

const areTiers = (values: readonly string[]): values is FixtureSize[] =>
  values.every(isTier)

const parseTiers = (raw: string | undefined): readonly FixtureSize[] => {
  if (raw === undefined) return TIER_VALUES
  const values = raw.split(',')
  if (!areTiers(values)) usageError(`invalid --tiers value: ${raw}`)
  return values
}

const parseRounds = (raw: string | undefined): number => {
  const rounds = raw === undefined ? DEFAULT_ROUNDS : Number(raw)
  if (!Number.isInteger(rounds) || rounds < MIN_ROUNDS) {
    usageError(`--rounds must be an integer >= ${MIN_ROUNDS}`)
  }
  return rounds
}

const parseExpectGain = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (Number.isNaN(value)) usageError('--expect-gain must be a number')
  return value
}

const parsePhase = (raw: string | undefined): Phase => {
  if (raw === undefined || !isPhase(raw)) {
    usageError(`--phase is required, one of: ${PHASES.join('|')}`)
  }
  return raw
}

const CLI_OPTIONS = {
  base: { type: 'string', default: 'main' },
  phase: { type: 'string' },
  tiers: { type: 'string' },
  rounds: { type: 'string' },
  'expect-gain': { type: 'string' },
} as const

const parseCliArgs = (argv: readonly string[]): CliOptions => {
  const { values } = parseArgs({ args: [...argv], options: CLI_OPTIONS })
  return {
    base: values.base,
    phase: parsePhase(values.phase),
    tiers: parseTiers(values.tiers),
    rounds: parseRounds(values.rounds),
    expectGain: parseExpectGain(values['expect-gain']),
  }
}

// ---- side preparation ----

const REPO_ROOT = process.cwd()
const COPIED_ENTRIES = ['src', 'tooling', 'package.json', 'tsconfig.json']
const MAX_BUFFER = 1024 * 1024 * 256

// Resolving first means a value like `--output=…` can never reach
// `git archive` as an option.
const resolveCommit = (ref: string): string =>
  execFileSync(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  ).trim()

const extractRef = (commit: string, dir: string): void => {
  const tar = execFileSync(
    'git',
    ['archive', '--format=tar', commit, ...COPIED_ENTRIES],
    { cwd: REPO_ROOT, maxBuffer: MAX_BUFFER }
  )
  execFileSync('tar', ['-x', '-C', dir], { input: tar, maxBuffer: MAX_BUFFER })
}

const createBaseSide = (ref: string): string => {
  const commit = resolveCommit(ref)
  const dir = mkdtempSync(join(tmpdir(), 'ab-base-'))
  try {
    extractRef(commit, dir)
  } catch (error) {
    cleanupDirs([dir])
    throw error
  }
  return dir
}

const createCandSide = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ab-cand-'))
  for (const entry of COPIED_ENTRIES) {
    cpSync(join(REPO_ROOT, entry), join(dir, entry), { recursive: true })
  }
  return dir
}

interface CompileOptions {
  readonly buildBinary: boolean
}

const compileSide = (dir: string, options: CompileOptions): void => {
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir')
  execFileSync(join(REPO_ROOT, 'node_modules/.bin/tsc'), ['-p', dir], {
    maxBuffer: MAX_BUFFER,
  })
  if (options.buildBinary) {
    execFileSync('node', ['tooling/build-bin.mjs'], {
      cwd: dir,
      maxBuffer: MAX_BUFFER,
    })
  }
}

// ---- dynamic module loading (no `any`) ----

interface MergerLike {
  mergeThreeWay(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean }
}

interface WriterLike {
  writeTo(
    out: Writable,
    ordered: JsonArray,
    namespaces: JsonObject
  ): Promise<void>
}

interface ConflictConstants {
  readonly DEFAULT_CONFLICT_MARKER_SIZE: number
  readonly DEFAULT_ANCESTOR_CONFLICT_TAG: string
  readonly DEFAULT_LOCAL_CONFLICT_TAG: string
  readonly DEFAULT_OTHER_CONFLICT_TAG: string
}

type ParserCtor = new () => ParityParser
type MergerCtor = new (config: MergeConfig) => MergerLike
type WriterCtor = new (config: MergeConfig) => WriterLike

const isParserCtor = (value: unknown): value is ParserCtor =>
  typeof value === 'function'
const isMergerCtor = (value: unknown): value is MergerCtor =>
  typeof value === 'function'
const isWriterCtor = (value: unknown): value is WriterCtor =>
  typeof value === 'function'

const isConflictConstants = (value: unknown): value is ConflictConstants => {
  const record = value as Record<string, unknown>
  return (
    typeof record['DEFAULT_CONFLICT_MARKER_SIZE'] === 'number' &&
    typeof record['DEFAULT_ANCESTOR_CONFLICT_TAG'] === 'string' &&
    typeof record['DEFAULT_LOCAL_CONFLICT_TAG'] === 'string' &&
    typeof record['DEFAULT_OTHER_CONFLICT_TAG'] === 'string'
  )
}

const PARSER_CANDIDATES = [
  {
    rel: 'lib/adapter/parser/CompactXmlParser.js',
    exportName: 'CompactXmlParser',
  },
  { rel: 'lib/adapter/TxmlXmlParser.js', exportName: 'TxmlXmlParser' },
] as const

const resolveParserModule = (
  dir: string
): { readonly path: string; readonly exportName: string } => {
  for (const candidate of PARSER_CANDIDATES) {
    const full = join(dir, candidate.rel)
    if (existsSync(full))
      return { path: full, exportName: candidate.exportName }
  }
  throw new Error(`no parser module found under ${dir}`)
}

const importExport = async <T>(
  path: string,
  exportName: string,
  guard: (value: unknown) => value is T
): Promise<T> => {
  const mod: unknown = await import(pathToFileURL(path).href)
  const record =
    typeof mod === 'object' && mod !== null
      ? (mod as Record<string, unknown>)
      : {}
  const value = record[exportName]
  if (!guard(value)) {
    throw new Error(`${path} does not export a valid ${exportName}`)
  }
  return value
}

const importModule = async <T>(
  path: string,
  guard: (value: unknown) => value is T
): Promise<T> => {
  const mod: unknown = await import(pathToFileURL(path).href)
  if (!guard(mod)) {
    throw new Error(`${path} does not export the expected shape`)
  }
  return mod
}

const buildMergeConfig = (constants: ConflictConstants): MergeConfig => ({
  conflictMarkerSize: constants.DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: constants.DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: constants.DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: constants.DEFAULT_OTHER_CONFLICT_TAG,
})

interface SideModules {
  readonly parser: ParityParser
  readonly Merger: MergerCtor
  readonly Writer: WriterCtor
  readonly config: MergeConfig
  readonly parserPath: string
  readonly parserExportName: string
}

const loadMergerAndWriter = async (
  dir: string
): Promise<Pick<SideModules, 'Merger' | 'Writer'>> => {
  const Merger = await importExport(
    join(dir, 'lib/merger/JsonMerger.js'),
    'JsonMerger',
    isMergerCtor
  )
  const Writer = await importExport(
    join(dir, 'lib/adapter/writer/XmlStreamWriter.js'),
    'XmlStreamWriter',
    isWriterCtor
  )
  return { Merger, Writer }
}

const loadSideModules = async (dir: string): Promise<SideModules> => {
  const { path: parserPath, exportName: parserExportName } =
    resolveParserModule(dir)
  const Parser = await importExport(parserPath, parserExportName, isParserCtor)
  const constants = await importModule(
    join(dir, 'lib/constant/conflictConstant.js'),
    isConflictConstants
  )
  return {
    parser: new Parser(),
    ...(await loadMergerAndWriter(dir)),
    config: buildMergeConfig(constants),
    parserPath,
    parserExportName,
  }
}

// ---- sampling ----

interface Pair<T> {
  readonly base: T
  readonly cand: T
}

const MIN_SAMPLE_MS = 50
const WARMUP_SAMPLES = 3

const timeUntilStable = async (
  operation: () => void | Promise<void>
): Promise<number> => {
  let iterations = 0
  const start = performance.now()
  let elapsed = 0
  do {
    await operation()
    iterations++
    elapsed = performance.now() - start
  } while (elapsed < MIN_SAMPLE_MS)
  return elapsed / iterations
}

// Collecting before every sample keeps one side's garbage from being
// swept on the other side's clock. Needs `node --expose-gc`.
const collectGarbage = (): void => {
  globalThis.gc?.()
}

const warnWithoutGc = (): void => {
  if (globalThis.gc !== undefined) return
  process.stderr.write(
    'warning: gc not exposed; run `node --expose-gc --import tsx …` for ' +
      'cleaner samples\n'
  )
}

const measured = async (sample: () => Promise<number>): Promise<number> => {
  collectGarbage()
  return sample()
}

const collectRound = async (
  samplers: Pair<() => Promise<number>>,
  baseFirst: boolean
): Promise<Pair<number>> => {
  if (baseFirst) {
    const base = await measured(samplers.base)
    return { base, cand: await measured(samplers.cand) }
  }
  const cand = await measured(samplers.cand)
  return { base: await measured(samplers.base), cand }
}

const collectPairedSamples = async (
  sampleBase: () => Promise<number>,
  sampleCand: () => Promise<number>,
  rounds: number
): Promise<Pair<number[]>> => {
  const samplers = { base: sampleBase, cand: sampleCand }
  for (let i = 0; i < WARMUP_SAMPLES; i++) await collectRound(samplers, true)
  const base: number[] = []
  const cand: number[] = []
  for (let i = 0; i < rounds; i++) {
    const round = await collectRound(samplers, i % 2 === 0)
    base.push(round.base)
    cand.push(round.cand)
  }
  return { base, cand }
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const min = (values: readonly number[]): number => Math.min(...values)

// ---- rows / reporting ----

interface Row {
  readonly tier: string
  readonly label: string
  readonly baseMedian: number
  readonly baseMin: number
  readonly candMedian: number
  readonly candMin: number
  readonly pairedDeltaPct: number
  readonly noisy: boolean
  readonly gated: boolean
}

// A side whose median sits this far above its min was disturbed by
// something outside the code under test; its verdict is not trusted.
const NOISE_LIMIT = 1.1
const PERCENT = 100

interface RowDescriptor {
  readonly tier: string
  readonly label: string
  readonly samples: Pair<number[]>
  readonly gated: boolean
}

// Median of the per-round ratios, so drift that hits both sides of a
// round cancels out instead of skewing two independent medians.
const pairedDeltaPct = (samples: Pair<number[]>): number => {
  const ratios = samples.base.map((base, i) => (samples.cand[i] ?? 0) / base)
  return (median(ratios) - 1) * PERCENT
}

const isNoisy = (values: readonly number[]): boolean =>
  median(values) / min(values) > NOISE_LIMIT

const toRow = ({ tier, label, samples, gated }: RowDescriptor): Row => ({
  tier,
  label,
  baseMedian: median(samples.base),
  baseMin: min(samples.base),
  candMedian: median(samples.cand),
  candMin: min(samples.cand),
  pairedDeltaPct: pairedDeltaPct(samples),
  noisy: isNoisy(samples.base) || isNoisy(samples.cand),
  gated,
})

const gainOf = (row: Row): number => -row.pairedDeltaPct

const formatRow = (row: Row): string =>
  `| ${row.tier} | ${row.label} | ${row.baseMedian.toFixed(2)} | ${row.baseMin.toFixed(2)} | ${row.candMedian.toFixed(2)} | ${row.candMin.toFixed(2)} | ${row.pairedDeltaPct.toFixed(1)}% | ${row.noisy ? 'noisy' : 'ok'} |`

const formatMarkdownTable = (rows: readonly Row[]): string => {
  const header =
    '| tier | label | base median (ms) | base min | cand median (ms) | cand min | Δ paired % | noise |'
  const separator = '|---|---|---|---|---|---|---|---|'
  return `${[header, separator, ...rows.map(formatRow)].join('\n')}\n`
}

const verdictOf = (rows: readonly Row[], expectGain: number): string => {
  const gated = rows.filter(row => row.gated)
  if (gated.some(row => row.noisy)) return 'unreliable'
  return gated.every(row => gainOf(row) >= expectGain) ? 'pass' : 'fail'
}

const printVerdict = (
  rows: readonly Row[],
  expectGain: number | undefined
): void => {
  if (expectGain === undefined) return
  const verdict = verdictOf(rows, expectGain)
  process.stdout.write(`verdict: ${verdict} (expect-gain ${expectGain}%)\n`)
  if (verdict !== 'pass') process.exitCode = 1
}

// ---- phase: parse ----

const runParsePhase = async (
  sides: Pair<SideModules>,
  tiers: readonly FixtureSize[],
  rounds: number
): Promise<Row[]> => {
  const rows: Row[] = []
  for (const tier of tiers) {
    const fixtures = generateProfileFixtures(tier)
    const sample =
      (side: SideModules): (() => Promise<number>) =>
      () =>
        timeUntilStable(() => {
          side.parser.parseString(fixtures.ancestor)
          side.parser.parseString(fixtures.local)
          side.parser.parseString(fixtures.other)
        })
    const samples = await collectPairedSamples(
      sample(sides.base),
      sample(sides.cand),
      rounds
    )
    rows.push(toRow({ tier, label: 'parse', samples, gated: true }))
  }
  return rows
}

// ---- phase: merge ----

interface MergeCase {
  readonly label: string
  readonly gated: boolean
  readonly ancestor: string
  readonly local: string
  readonly other: string
}

const mergeCasesFor = (tier: FixtureSize): readonly MergeCase[] => {
  const fixtures = generateProfileFixtures(tier)
  return [
    {
      label: 'clean',
      gated: true,
      ancestor: fixtures.ancestor,
      local: fixtures.local,
      other: fixtures.other,
    },
    {
      label: 'conflict',
      gated: false,
      ancestor: fixtures.ancestor,
      local: fixtures.conflictLocal,
      other: fixtures.conflictOther,
    },
  ]
}

const mergeSampler = (
  side: SideModules,
  mergeCase: MergeCase
): (() => Promise<number>) => {
  const ancestor = side.parser.parseString(mergeCase.ancestor).content
  const local = side.parser.parseString(mergeCase.local).content
  const other = side.parser.parseString(mergeCase.other).content
  return () =>
    timeUntilStable(() => {
      new side.Merger(side.config).mergeThreeWay(ancestor, local, other)
    })
}

const runMergePhase = async (
  sides: Pair<SideModules>,
  tiers: readonly FixtureSize[],
  rounds: number
): Promise<Row[]> => {
  const rows: Row[] = []
  for (const tier of tiers) {
    for (const mergeCase of mergeCasesFor(tier)) {
      const samples = await collectPairedSamples(
        mergeSampler(sides.base, mergeCase),
        mergeSampler(sides.cand, mergeCase),
        rounds
      )
      rows.push(
        toRow({ tier, label: mergeCase.label, samples, gated: mergeCase.gated })
      )
    }
  }
  return rows
}

// ---- phase: pipeline ----

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

const pipelineSampler =
  (
    side: SideModules,
    fixtures: ReturnType<typeof generateProfileFixtures>
  ): (() => Promise<number>) =>
  () =>
    timeUntilStable(async () => {
      const ancestor = side.parser.parseString(fixtures.ancestor)
      const local = side.parser.parseString(fixtures.local)
      const other = side.parser.parseString(fixtures.other)
      const merged = new side.Merger(side.config).mergeThreeWay(
        ancestor.content,
        local.content,
        other.content
      )
      const namespaces = mergeNamespaces(
        ancestor.namespaces,
        local.namespaces,
        other.namespaces
      )
      const sink = new PassThrough()
      sink.resume()
      await new side.Writer(side.config).writeTo(
        sink,
        merged.output,
        namespaces
      )
      sink.end()
    })

const runPipelinePhase = async (
  sides: Pair<SideModules>,
  tiers: readonly FixtureSize[],
  rounds: number
): Promise<Row[]> => {
  const rows: Row[] = []
  for (const tier of tiers) {
    const fixtures = generateProfileFixtures(tier)
    const samples = await collectPairedSamples(
      pipelineSampler(sides.base, fixtures),
      pipelineSampler(sides.cand, fixtures),
      rounds
    )
    rows.push(toRow({ tier, label: 'pipeline', samples, gated: true }))
  }
  return rows
}

// ---- phase: rss ----

const writeRssTrio = (workDir: string): readonly string[] => {
  const trioDir = join(workDir, 'rss')
  mkdirSync(trioDir)
  const fixtures = generateProfileFixtures('xl')
  const names = ['ancestor', 'local', 'other'] as const
  const contents = {
    ancestor: fixtures.ancestor,
    local: fixtures.local,
    other: fixtures.other,
  }
  return names.map(name => {
    const path = join(trioDir, `${name}.xml`)
    writeFileSync(path, contents[name])
    return path
  })
}

const buildRssChildScript = (
  parserPath: string,
  exportName: string,
  files: readonly string[]
): string =>
  [
    "import { readFileSync } from 'node:fs'",
    "import { pathToFileURL } from 'node:url'",
    `const mod = await import(pathToFileURL(${JSON.stringify(parserPath)}).href)`,
    `const Parser = mod[${JSON.stringify(exportName)}]`,
    'const parser = new Parser()',
    `for (const file of ${JSON.stringify(files)}) parser.parseString(readFileSync(file, 'utf8'))`,
    'process.stdout.write(String(process.resourceUsage().maxRSS))',
  ].join('\n')

const sampleRss = (
  parserPath: string,
  exportName: string,
  files: readonly string[]
): number => {
  const script = buildRssChildScript(parserPath, exportName, files)
  const result = spawnSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`rss child exited ${result.status}: ${result.stderr}`)
  }
  return Number(result.stdout)
}

const runRssPhase = async (
  sides: Pair<SideModules>,
  workDir: string,
  rounds: number
): Promise<Row[]> => {
  const files = writeRssTrio(workDir)
  const samples = await collectPairedSamples(
    async () =>
      sampleRss(sides.base.parserPath, sides.base.parserExportName, files),
    async () =>
      sampleRss(sides.cand.parserPath, sides.cand.parserExportName, files),
    rounds
  )
  return [toRow({ tier: 'xl', label: 'rss', samples, gated: true })]
}

// ---- phase: binary ----

interface SideDirs extends Pair<string> {
  readonly work: string
}

interface BinaryTrio {
  readonly ancestor: string
  readonly local: string
  readonly other: string
  readonly ours: string
}

const writeTierTrio = (dir: string, size: FixtureSize): BinaryTrio => {
  mkdirSync(dir)
  const fixtures = generateProfileFixtures(size)
  const ancestor = join(dir, 'ancestor.xml')
  const local = join(dir, 'local.xml')
  const other = join(dir, 'other.xml')
  const ours = join(dir, 'ours.xml')
  writeFileSync(ancestor, fixtures.ancestor)
  writeFileSync(local, fixtures.local)
  writeFileSync(other, fixtures.other)
  return { ancestor, local, other, ours }
}

const sampleBinary = (binPath: string, trio: BinaryTrio): number => {
  copyFileSync(trio.local, trio.ours)
  const start = performance.now()
  const result = spawnSync('node', [
    binPath,
    '-O',
    trio.ancestor,
    '-A',
    trio.ours,
    '-B',
    trio.other,
    '-P',
    trio.ours,
  ])
  const elapsed = performance.now() - start
  if (result.status !== 0) {
    throw new Error(`binary exited ${result.status}`)
  }
  return elapsed
}

const runBinaryPhase = async (
  dirs: SideDirs,
  tiers: readonly FixtureSize[],
  rounds: number
): Promise<Row[]> => {
  const rows: Row[] = []
  for (const tier of tiers) {
    const baseTrio = writeTierTrio(join(dirs.work, `bin-base-${tier}`), tier)
    const candTrio = writeTierTrio(join(dirs.work, `bin-cand-${tier}`), tier)
    const baseBin = join(dirs.base, 'bin/merge-driver.cjs')
    const candBin = join(dirs.cand, 'bin/merge-driver.cjs')
    const samples = await collectPairedSamples(
      async () => sampleBinary(baseBin, baseTrio),
      async () => sampleBinary(candBin, candTrio),
      rounds
    )
    rows.push(toRow({ tier, label: 'binary', samples, gated: true }))
  }
  reportBundleSizes(dirs)
  return rows
}

const reportBundleSizes = (dirs: Pair<string>): void => {
  const baseSize = statSync(join(dirs.base, 'bin/merge-driver.cjs')).size
  const candSize = statSync(join(dirs.cand, 'bin/merge-driver.cjs')).size
  process.stdout.write(
    `bundle sizes: base ${baseSize} bytes, cand ${candSize} bytes\n`
  )
}

// ---- phase: snapshot ----

const OUTCOMES_SNAPSHOT_PATH = 'test/fixtures/parser-parity/outcomes.json'

const writeSnapshot = (parser: ParityParser): void => {
  const snapshot = buildParitySnapshot(parser)
  mkdirSync(dirname(OUTCOMES_SNAPSHOT_PATH), { recursive: true })
  writeFileSync(
    OUTCOMES_SNAPSHOT_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`
  )
  process.stdout.write(`wrote ${OUTCOMES_SNAPSHOT_PATH}\n`)
}

// ---- dispatch ----

const runPairedPhase = async (
  phase: PairedPhase,
  sides: Pair<SideModules>,
  dirs: SideDirs,
  tiers: readonly FixtureSize[],
  rounds: number
): Promise<Row[]> => {
  switch (phase) {
    case 'parse':
      return runParsePhase(sides, tiers, rounds)
    case 'merge':
      return runMergePhase(sides, tiers, rounds)
    case 'pipeline':
      return runPipelinePhase(sides, tiers, rounds)
    case 'rss':
      return runRssPhase(sides, dirs.work, rounds)
    case 'binary':
      return runBinaryPhase(dirs, tiers, rounds)
  }
}

function cleanupDirs(dirs: readonly string[]): void {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (error) {
      process.stderr.write(`cleanup failed for ${dir}: ${toMessage(error)}\n`)
      process.exitCode = 1
    }
  }
}

const runSnapshot = async (base: string): Promise<void> => {
  const baseDir = createBaseSide(base)
  try {
    compileSide(baseDir, { buildBinary: false })
    const { parser } = await loadSideModules(baseDir)
    writeSnapshot(parser)
  } finally {
    cleanupDirs([baseDir])
  }
}

const prepareSides = async (
  dirs: SideDirs,
  phase: PairedPhase
): Promise<Pair<SideModules>> => {
  const buildBinary = phase === 'binary'
  compileSide(dirs.base, { buildBinary })
  compileSide(dirs.cand, { buildBinary })
  return {
    base: await loadSideModules(dirs.base),
    cand: await loadSideModules(dirs.cand),
  }
}

const runPaired = async (
  options: CliOptions,
  phase: PairedPhase
): Promise<void> => {
  const created: string[] = []
  const track = (dir: string): string => {
    created.push(dir)
    return dir
  }
  try {
    const dirs: SideDirs = {
      base: track(createBaseSide(options.base)),
      cand: track(createCandSide()),
      work: track(mkdtempSync(join(tmpdir(), 'ab-work-'))),
    }
    const sides = await prepareSides(dirs, phase)
    const { tiers, rounds, expectGain } = options
    const rows = await runPairedPhase(phase, sides, dirs, tiers, rounds)
    process.stdout.write(formatMarkdownTable(rows))
    printVerdict(rows, expectGain)
  } finally {
    cleanupDirs(created)
  }
}

const main = async (): Promise<void> => {
  const options = parseCliArgs(process.argv.slice(2))
  warnWithoutGc()
  if (options.phase === 'snapshot') {
    await runSnapshot(options.base)
    return
  }
  await runPaired(options, options.phase)
}

await main()
