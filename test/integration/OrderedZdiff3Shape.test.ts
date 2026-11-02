import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mergeOrderedArrays } from '../../src/merger/nodes/ordered/mergeOrdered.js'
import {
  type LiveSide,
  type OrderedEntry,
  valueOn,
} from '../../src/merger/nodes/ordered/orderedEntry.js'
import { isConflictBlock } from '../../src/types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'
import type { MergeResult } from '../../src/types/mergeResult.js'
import { jsonEqual } from '../../src/utils/jsonEqual.js'
import {
  type Case,
  caseArb,
  SMALL,
  SMALL_ANCESTORS,
  type Tokens,
} from '../utils/orderedCases.js'
import {
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
} from '../utils/orderedTokens.js'
import { keyOfToken, oracleReadings } from '../utils/readingOracle.js'
import { defaultConfig } from '../utils/testConfig.js'

// git is a black box here: its output is read, never reproduced. The claim
// measured is that a conflict block is never wider than git's hunk for the
// same region, except where the entry model forces it.

const GIT = 'git'
const LOCAL_LABEL = 'L'
const ANCESTOR_LABEL = 'A'
const OTHER_LABEL = 'O'
const MAX_CONFLICT_COUNT = 127
const START_MARKER = '<<<<<<<'
const BASE_MARKER = '|||||||'
const MIDDLE_MARKER = '======='
const END_MARKER = '>>>>>>>'
const GIT_TEST_TIMEOUT_MS = 60_000

interface Hunk {
  readonly local: string[]
  readonly ancestor: string[]
  readonly other: string[]
}

type GitItem = string | Hunk

interface GitOutcome {
  readonly conflicts: number
  readonly items: readonly GitItem[]
}

type HunkSide = keyof Hunk

const gitAvailable = spawnSync(GIT, ['--version']).status === 0

const parseGit = (stdout: string): GitItem[] => {
  const items: GitItem[] = []
  let hunk: Hunk | undefined
  let side: HunkSide = 'local'
  const lines = stdout.split('\n').filter(line => line !== '')
  for (const line of lines) {
    if (line.startsWith(START_MARKER)) {
      hunk = { local: [], ancestor: [], other: [] }
      side = 'local'
    } else if (line.startsWith(BASE_MARKER)) side = 'ancestor'
    else if (line === MIDDLE_MARKER) side = 'other'
    else if (line.startsWith(END_MARKER) && hunk) {
      items.push(hunk)
      hunk = undefined
    } else if (hunk) hunk[side].push(line)
    else items.push(line)
  }
  return items
}

const writeSide = (directory: string, name: string, tokens: Tokens): void =>
  writeFileSync(
    join(directory, name),
    tokens.map(token => `${token}\n`).join('')
  )

const gitMerge = (directory: string, [ancestor, local, other]: Case) => {
  writeSide(directory, 'a', ancestor)
  writeSide(directory, 'l', local)
  writeSide(directory, 'o', other)
  const run = spawnSync(
    GIT,
    [
      'merge-file',
      '-p',
      '--zdiff3',
      ...['-L', LOCAL_LABEL, '-L', ANCESTOR_LABEL, '-L', OTHER_LABEL],
      'l',
      'a',
      'o',
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    }
  )
  // The exit code is the number of conflicts; anything else is a failure
  if (run.status === null || run.status > MAX_CONFLICT_COUNT) {
    throw new Error(`git merge-file failed: ${run.stderr}`)
  }
  return { conflicts: run.status, items: parseGit(run.stdout) } as GitOutcome
}

const mergeCase = ([ancestor, local, other]: Case): MergeResult =>
  mergeOrderedArrays(
    orderedSides(ancestor.join(' '), local.join(' '), other.join(' ')),
    ORDERED_ATTRIBUTE,
    defaultConfig
  )

// ---- what the driver's output holds, as key sets

const keyOfEntry = (entry: JsonObject): string[] => {
  const key = entry['fullName']
  return typeof key === 'string' ? [key] : []
}

const keysOfSide = (side: JsonArray): string[] =>
  side.flatMap(item =>
    keyOfEntry((item as JsonObject)[ORDERED_ATTRIBUTE] as JsonObject)
  )

// The base is the ancestor region and carries entries both sides deleted
// (agreed deletions are part of it): what a block disputes is its live sides.
const keysOfBlock = (block: { local: JsonArray; other: JsonArray }) =>
  new Set([...keysOfSide(block.local), ...keysOfSide(block.other)])

// An entry whose fields conflict is a block of its own key
const keysOfFieldConflict = (item: JsonObject): Set<string> | undefined => {
  const fields = item[ORDERED_ATTRIBUTE]
  if (!Array.isArray(fields) || !fields.some(isConflictBlock)) return undefined
  return new Set(
    fields.flatMap(field =>
      isConflictBlock(field) ? [] : keyOfEntry(field as JsonObject)
    )
  )
}

const blockKeySets = (result: MergeResult): Set<string>[] =>
  result.output.flatMap(item =>
    isConflictBlock(item)
      ? [keysOfBlock(item)]
      : [keysOfFieldConflict(item as JsonObject)].filter(
          (keys): keys is Set<string> => keys !== undefined
        )
  )

// ---- what git's text holds

const isHunk = (item: GitItem): item is Hunk => typeof item !== 'string'

const hunksOf = (git: GitOutcome): Hunk[] => git.items.filter(isHunk)

const keySetOf = (tokens: Tokens): Set<string> =>
  new Set(tokens.map(keyOfToken))

const hunkKeySet = (hunk: Hunk): Set<string> =>
  keySetOf([...hunk.local, ...hunk.ancestor, ...hunk.other])

const countKeys = (tokens: Tokens): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    const key = keyOfToken(token)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const isSubset = (inner: ReadonlySet<string>, outer: ReadonlySet<string>) =>
  [...inner].every(key => outer.has(key))

const withinSomeHunk = (block: Set<string>, git: GitOutcome): boolean =>
  hunksOf(git).some(hunk => isSubset(block, hunkKeySet(hunk)))

// ---- the witnessed exceptions

const mostOnASide = ([ancestor, local, other]: Case, key: string): number =>
  Math.max(
    ...[ancestor, local, other].map(side => countKeys(side).get(key) ?? 0)
  )

const emissionsOf = (git: GitOutcome): Map<string, number> => {
  const emitted = new Map<string, number>()
  const add = (key: string, times: number) =>
    emitted.set(key, (emitted.get(key) ?? 0) + times)
  for (const item of git.items) {
    if (!isHunk(item)) {
      add(keyOfToken(item), 1)
      continue
    }
    const local = countKeys(item.local)
    const other = countKeys(item.other)
    for (const key of new Set([...local.keys(), ...other.keys()])) {
      add(key, Math.max(local.get(key) ?? 0, other.get(key) ?? 0))
    }
  }
  return emitted
}

// Each witness excuses the one block it holds for, never a sibling block
type BlockWitness = (
  sides: Case,
  git: GitOutcome,
  block: Set<string>
) => boolean

// W1: git's text holds an entry of the block twice (clean lines plus hunk sides)
const gitHoldsAKeyTwice: BlockWitness = (sides, git, block) =>
  [...emissionsOf(git)].some(
    ([key, times]) => block.has(key) && times > mostOnASide(sides, key)
  )

// W2: git emits clean an entry of the block that one side deleted
const gitResurrects: BlockWitness = ([ancestor, local, other], git, block) =>
  git.items.some(item => {
    if (isHunk(item)) return false
    const key = keyOfToken(item)
    const deletedOnASide = [local, other].some(side => !keySetOf(side).has(key))
    return block.has(key) && deletedOnASide && keySetOf(ancestor).has(key)
  })

const sameKeySequence = (left: Tokens, right: Tokens): boolean =>
  left.map(keyOfToken).join() === right.map(keyOfToken).join()

// W3: a hunk over the block whose two live sides hold the same keys in order
const gitHasContentHunk: BlockWitness = (_sides, git, block) =>
  hunksOf(git).some(
    hunk =>
      sameKeySequence(hunk.local, hunk.other) &&
      [...hunkKeySet(hunk)].some(key => block.has(key))
  )

// W4: a side repeats a key of the block
const someSideRepeatsAKey: BlockWitness = (sides, _git, block) =>
  sides.some(side => {
    const counts = countKeys(side)
    return [...block].some(key => (counts.get(key) ?? 0) > 1)
  })

const WITNESSES = {
  W1: gitHoldsAKeyTwice,
  W2: gitResurrects,
  W3: gitHasContentHunk,
  W4: someSideRepeatsAKey,
} as const

// ---- a clean merge where git conflicts

// A kept entry whose relative order changed cannot be seen by a line diff
const orderChanged = (ancestor: Tokens, side: Tokens): boolean => {
  const ranks = side
    .map(token =>
      ancestor.findIndex(kept => keyOfToken(kept) === keyOfToken(token))
    )
    .filter(rank => rank >= 0)
  return ranks.some(
    (rank, index) => index > 0 && rank < (ranks[index - 1] as number)
  )
}

const sameValue = (
  left: JsonObject | undefined,
  right: JsonObject | undefined
): boolean =>
  left === undefined || right === undefined
    ? left === right
    : jsonEqual(left, right)

const touchedOn = (entry: OrderedEntry, side: LiveSide): boolean =>
  sameValue(entry.ancestor, valueOn(entry, side)) === false

// Changes both sides made alike are agreed (deleted by both, added by both)
const isDisputed = (entry: OrderedEntry): boolean =>
  touchedOn(entry, 'local') &&
  touchedOn(entry, 'other') &&
  !sameValue(entry.local, entry.other)

// Entries are what the identity readings say they are: with a repeated key a
// key is not the unit of a change, so disjointness is read per reading.
const sidesTouchDisjointEntries = ([ancestor, local, other]: Case): boolean =>
  oracleReadings(ancestor, local, other).every(
    reading => !reading.some(isDisputed)
  )

const CLEAN_WITNESSES = {
  moved: ([ancestor, local, other]: Case) =>
    orderChanged(ancestor, local) || orderChanged(ancestor, other),
  disjoint: sidesTouchDisjointEntries,
  edited: (_sides: Case, git: GitOutcome) =>
    hunksOf(git).some(
      hunk =>
        sameKeySequence(hunk.local, hunk.other) &&
        sameKeySequence(hunk.ancestor, hunk.other)
    ),
} as const

// ---- verdict

type Witness = keyof typeof WITNESSES | keyof typeof CLEAN_WITNESSES | 'W5'

interface Verdict {
  readonly violation?: string
  readonly witnessed: readonly Witness[]
}

const holding = <W extends string>(
  witnesses: Record<W, (sides: Case, git: GitOutcome) => boolean>,
  sides: Case,
  git: GitOutcome
): W[] =>
  (Object.keys(witnesses) as W[]).filter(name => witnesses[name](sides, git))

const holdingFor = (
  sides: Case,
  git: GitOutcome,
  block: Set<string>
): (keyof typeof WITNESSES)[] =>
  (Object.keys(WITNESSES) as (keyof typeof WITNESSES)[]).filter(name =>
    WITNESSES[name](sides, git, block)
  )

// ---- W5: identity where git has none (ADR 051, ADR 059)
//
// Git reads an edited entry as a deleted line plus an inserted one, so when a
// side also reordered it, the entry drops out of git's hunk and the entries
// around it stay clean. The driver knows the entry is one edited entry (ADR
// 051) whose order against the other insertions conflicts, and each block side
// is a contiguous verbatim slice (ADR 059): an entry written between block
// members on a side is pulled in with them.

const firstIndexOf = (side: Tokens, key: string): number =>
  side.findIndex(token => keyOfToken(token) === key)

const orderInverted = (ancestor: Tokens, side: Tokens, key: string) =>
  [...new Set(side.map(keyOfToken))]
    .filter(other => other !== key && firstIndexOf(ancestor, other) >= 0)
    .some(
      other =>
        (firstIndexOf(side, key) - firstIndexOf(side, other)) *
          (firstIndexOf(ancestor, key) - firstIndexOf(ancestor, other)) <
        0
    )

const editedByASide = (ancestor: Tokens, side: Tokens, key: string) =>
  side.some(
    token =>
      keyOfToken(token) === key &&
      !ancestor.includes(token) &&
      firstIndexOf(ancestor, key) >= 0
  )

const editedAndReordered = ([ancestor, local, other]: Case, key: string) =>
  [local, other].some(
    side =>
      editedByASide(ancestor, side, key) && orderInverted(ancestor, side, key)
  )

const liesBetween = (side: Tokens, members: string[], extra: string) => {
  const at = members.map(key => firstIndexOf(side, key)).filter(i => i >= 0)
  const index = firstIndexOf(side, extra)
  return index > Math.min(...at) && index < Math.max(...at)
}

const isCleanInGit = (git: GitOutcome, key: string) =>
  git.items.some(item => !isHunk(item) && keyOfToken(item) === key)

const identityDrivenWidth = (
  sides: Case,
  git: GitOutcome,
  block: Set<string>
): boolean => {
  const inHunk = (key: string) =>
    hunksOf(git).some(hunk => hunkKeySet(hunk).has(key))
  const extras = [...block].filter(
    key => !inHunk(key) && isCleanInGit(git, key)
  )
  const members = [...block].filter(key => !extras.includes(key))
  return (
    extras.length > 0 &&
    members.some(key => editedAndReordered(sides, key)) &&
    extras.every(extra =>
      [sides[1], sides[2]].some(side => liesBetween(side, members, extra))
    )
  )
}

const witnessesOfBlock = (
  sides: Case,
  git: GitOutcome,
  block: Set<string>
): Witness[] => {
  const witnessed: Witness[] = holdingFor(sides, git, block)
  if (witnessed.length === 0 && identityDrivenWidth(sides, git, block)) {
    witnessed.push('W5')
  }
  return witnessed
}

const blocksVerdict = (
  sides: Case,
  git: GitOutcome,
  merged: MergeResult
): Verdict => {
  const wide = blockKeySets(merged).filter(block => !withinSomeHunk(block, git))
  const perBlock = wide.map(block => ({
    block,
    witnessed: witnessesOfBlock(sides, git, block),
  }))
  const unjustified = perBlock.find(({ witnessed }) => witnessed.length === 0)
  const witnessed = perBlock.flatMap(entry => entry.witnessed)
  return unjustified === undefined
    ? { witnessed }
    : {
        witnessed,
        violation: `block over ${[...unjustified.block]} is wider than any git hunk`,
      }
}

const cleanVerdict = (sides: Case, git: GitOutcome): Verdict => {
  const witnessed = holding(CLEAN_WITNESSES, sides, git)
  return witnessed.length > 0
    ? { witnessed }
    : { witnessed, violation: 'clean while git conflicts, with no witness' }
}

const verdictOf = (directory: string, sides: Case): Verdict => {
  const git = gitMerge(directory, sides)
  const merged = mergeCase(sides)
  if (git.conflicts === 0) return { witnessed: [] }
  return merged.hasConflict
    ? blocksVerdict(sides, git, merged)
    : cleanVerdict(sides, git)
}

// ---- generators

const KEYS = ['A', 'B', 'C', 'D', 'E'] as const
const ALPHABET = [...KEYS, 'X', 'Y'] as const

// At most one entry of the side is edited, and only one the ancestor holds
const editedAt = (
  side: Tokens,
  ancestor: Tokens,
  mark: string,
  pick: number | null
): Tokens => {
  const editable = side.flatMap((token, index) =>
    ancestor.includes(token) ? [index] : []
  )
  if (pick === null || editable.length === 0) return side
  const target = editable[pick % editable.length]
  return side.map((token, index) =>
    index === target ? `${token}${mark}` : token
  )
}

const liveSideArb = (ancestor: Tokens, mark: string): fc.Arbitrary<Tokens> =>
  fc
    .tuple(
      fc.shuffledSubarray([...ALPHABET]),
      fc.option(fc.nat(), { nil: null })
    )
    .map(([side, pick]) => editedAt(side, ancestor, mark, pick))

const distinctKeysArb: fc.Arbitrary<Case> = fc
  .shuffledSubarray([...KEYS])
  .chain(ancestor =>
    fc
      .tuple(liveSideArb(ancestor, '*'), liveSideArb(ancestor, '+'))
      .map(([local, other]): Case => [ancestor, local, other])
  )

const repeatedKeysArb = caseArb(SMALL_ANCESTORS, SMALL)

// ---- the property

const tally = new Map<string, number>()
const note = (witnessed: readonly Witness[]) =>
  witnessed.forEach(name => tally.set(name, (tally.get(name) ?? 0) + 1))

describe.skipIf(!gitAvailable)('ordered merge shape against git zdiff3', () => {
  let directory: string

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'zdiff3-shape-'))
  })

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true })
    console.log(`witnesses used: ${JSON.stringify(Object.fromEntries(tally))}`)
  })

  describe('given an edited entry that a side also moved among agreed insertions', () => {
    describe('when the driver blocks the whole array and git leaves a moved entry clean', () => {
      it('then the block is the identity-driven width', () => {
        // Arrange
        const sides: Case = [
          ['A', 'E'],
          ['E', 'D', 'A*', 'C', 'B', 'X', 'Y'],
          ['A', 'E', 'Y', 'C', 'D', 'B'],
        ]
        const sut = mergeCase

        // Act
        const result = sut(sides)
        const verdict = verdictOf(directory, sides)

        // Assert
        expect(formatResult(result)).toBe('<E,D,A*,C,B,X,Y|A,E|A,E,Y,C,D,B>')
        expect(verdict).toEqual({ witnessed: ['W5'] })
      })
    })
  })

  describe.each([
    ['distinct keys', distinctKeysArb],
    ['repeated keys', repeatedKeysArb],
  ])('given sides over %s', (_name, arbitrary) => {
    describe('when git and the driver both conflict, or only git does', () => {
      it(
        'then no block is wider than git unless the entry model forces it',
        () => {
          // Arrange
          const sut = (sides: Case) => verdictOf(directory, sides)

          // Act / Assert
          fc.assert(
            fc.property(arbitrary, sides => {
              const verdict = sut(sides)
              note(verdict.witnessed)
              expect(verdict.violation, JSON.stringify(sides)).toBeUndefined()
            })
          )
        },
        GIT_TEST_TIMEOUT_MS
      )
    })
  })
})
