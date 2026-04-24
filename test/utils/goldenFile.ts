import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'

type ParityMode =
  | { readonly mode: 'parity' }
  | {
      readonly mode: 'divergence'
      readonly against: string
      readonly adr: string
    }

interface Fixture {
  readonly id: string
  readonly dir: string
  readonly parity: ParityMode
  readonly inputs: {
    readonly ancestor?: string
    readonly ours?: string
    readonly theirs?: string
    readonly ordered?: JsonArray
    readonly namespaces?: JsonObject
  }
  readonly expectedCurrent: string
  readonly expectedNew?: string
}

// `new URL().pathname` returns `/D:/...` on Windows with a leading slash,
// which `path.join` then concatenates onto `D:\` producing invalid
// `D:\D:\...`. `fileURLToPath` handles the drive-letter + slash
// normalisation across POSIX and Windows.
const FIXTURES_ROOT = fileURLToPath(
  new URL('../fixtures/xml/', import.meta.url)
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validateParity = (value: unknown, dir: string): ParityMode => {
  if (!isRecord(value)) {
    throw new Error(`[${dir}] parity.json must be an object`)
  }
  const mode = value['mode']
  if (mode === 'parity') {
    return { mode: 'parity' }
  }
  if (mode === 'divergence') {
    const against = value['against']
    const adr = value['adr']
    if (typeof against !== 'string' || typeof adr !== 'string') {
      throw new Error(
        `[${dir}] divergence mode requires 'against' and 'adr' string fields`
      )
    }
    return { mode: 'divergence', against, adr }
  }
  throw new Error(`[${dir}] parity.json mode must be 'parity' or 'divergence'`)
}

const readOptional = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

const readJsonOptional = <T>(path: string): T | undefined => {
  const raw = readOptional(path)
  return raw === undefined ? undefined : (JSON.parse(raw) as T)
}

const readRequired = (path: string, dir: string, name: string): string => {
  const raw = readOptional(path)
  if (raw === undefined) {
    throw new Error(`[${dir}] missing required file ${name}`)
  }
  return raw
}

const loadFixture = (id: string): Fixture => {
  const dir = join(FIXTURES_ROOT, id)
  const parity = validateParity(
    JSON.parse(readRequired(join(dir, 'parity.json'), id, 'parity.json')),
    id
  )
  const expectedCurrent = readRequired(
    join(dir, 'expected.xml'),
    id,
    'expected.xml'
  )
  const expectedNew =
    parity.mode === 'divergence'
      ? readRequired(join(dir, 'expected-new.xml'), id, 'expected-new.xml')
      : undefined
  const orderedInput = readJsonOptional<{
    ordered: JsonArray
    namespaces?: JsonObject
  }>(join(dir, 'ordered-input.json'))

  // exactOptionalPropertyTypes requires that optional properties
  // either carry a defined value or be absent (not {key: undefined}).
  // Build the object in-flight via a writable mutable shape, then
  // assert-narrow to the readonly Fixture['inputs'] at return.
  type MutableInputs = {
    ancestor?: string
    ours?: string
    theirs?: string
    ordered?: JsonArray
    namespaces?: JsonObject
  }
  const inputs: MutableInputs = {}
  const ancestor = readOptional(join(dir, 'ancestor.xml'))
  if (ancestor !== undefined) inputs.ancestor = ancestor
  const ours = readOptional(join(dir, 'ours.xml'))
  if (ours !== undefined) inputs.ours = ours
  const theirs = readOptional(join(dir, 'theirs.xml'))
  if (theirs !== undefined) inputs.theirs = theirs
  if (orderedInput !== undefined) {
    inputs.ordered = orderedInput.ordered
    if (orderedInput.namespaces !== undefined) {
      inputs.namespaces = orderedInput.namespaces
    }
  }

  const result: Fixture = {
    id,
    dir,
    parity,
    inputs: inputs as Fixture['inputs'],
    expectedCurrent,
  }
  if (expectedNew !== undefined) {
    return { ...result, expectedNew }
  }
  return result
}

export const listFixtures = (): Fixture[] => {
  const ids = readdirSync(FIXTURES_ROOT).filter((name: string) => {
    const full = join(FIXTURES_ROOT, name)
    try {
      return statSync(full).isDirectory()
    } catch {
      return false
    }
  })
  ids.sort()
  return ids.map(loadFixture)
}
