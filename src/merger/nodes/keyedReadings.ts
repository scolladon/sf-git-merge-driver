import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import { jsonEqual } from '../../utils/jsonEqual.js'
import type { KeyedSides } from './KeyedArrayIndex.js'

type Pair = readonly [ancestorIndex: number, sideIndex: number]
export type Matching = readonly Pair[]

interface MatchState {
  readonly used: ReadonlySet<number>
  readonly pairs: Matching
  // Last ancestor index each value class was given: identical copies of one
  // value take ancestor copies in order, a crossing would fabricate a move.
  readonly floors: ReadonlyMap<number, number>
}

const NO_FLOOR = -1

const extend = (state: MatchState, pair: Pair): MatchState => ({
  ...state,
  used: new Set([...state.used, pair[0]]),
  pairs: [...state.pairs, pair],
})

const extendIdentical = (
  state: MatchState,
  pair: Pair,
  sideClass: number
): MatchState => ({
  ...extend(state, pair),
  floors: new Map([...state.floors, [sideClass, pair[0]]]),
})

const unusedIndices = (
  ancestorClasses: readonly number[],
  state: MatchState,
  keep: (ancestorClass: number) => boolean
): number[] =>
  ancestorClasses.flatMap((ancestorClass, index) =>
    !state.used.has(index) && keep(ancestorClass) ? [index] : []
  )

function* freeExtensions(
  ancestorClasses: readonly number[],
  sideIndex: number,
  state: MatchState
): Generator<MatchState> {
  const paired = state.pairs.some(([, side]) => side === sideIndex)
  const candidates = paired
    ? []
    : unusedIndices(ancestorClasses, state, () => true)
  if (candidates.length === 0) yield state
  for (const candidate of candidates) {
    yield extend(state, [candidate, sideIndex])
  }
}

function* freePhase(
  ancestorClasses: readonly number[],
  sideIndex: number,
  sideCount: number,
  state: MatchState
): Generator<Matching> {
  if (sideIndex === sideCount) {
    yield state.pairs
    return
  }
  for (const next of freeExtensions(ancestorClasses, sideIndex, state)) {
    yield* freePhase(ancestorClasses, sideIndex + 1, sideCount, next)
  }
}

// A copy may skip unused ancestor copies only if enough remain above it for
// the same-class copies still to place. Identical copies share one identity
// (ADR 070): without this bound k of them explore every increasing
// subsequence (2^k) to reach the one matching that works.
const leavesRoomAbove = (
  position: number,
  unusedCount: number,
  stillToPlace: number
): boolean =>
  // Stryker disable next-line ArithmeticOperator: pruning only: a copy taken with fewer same-class copies above than still to place leaves the unused one at index 0 below the floor, so a later copy finds no candidate above the floor and the branch yields nothing
  position === 0 || unusedCount - position - 1 >= stillToPlace

const copiesAfter = (
  sideClasses: readonly number[],
  sideIndex: number
): number =>
  sideClasses
    .slice(sideIndex + 1)
    .filter(sideClass => sideClass === sideClasses[sideIndex]).length

function* identicalExtensions(
  ancestorClasses: readonly number[],
  sideClasses: readonly number[],
  sideIndex: number,
  state: MatchState
): Generator<MatchState> {
  const sideClass = sideClasses[sideIndex]
  const floor = state.floors.get(sideClass) ?? NO_FLOOR
  const sameClass = unusedIndices(ancestorClasses, state, c => c === sideClass)
  const stillToPlace = copiesAfter(sideClasses, sideIndex)
  // A same-class copy left below the floor would be skipped by the order.
  if (sameClass.length === 0) yield state
  for (const [position, candidate] of sameClass.entries()) {
    // Stryker disable EqualityOperator: the floor is the ancestor index of the last identical pair of the class, already used, and candidates are unused
    if (
      candidate > floor &&
      leavesRoomAbove(position, sameClass.length, stillToPlace)
    ) {
      yield extendIdentical(state, [candidate, sideIndex], sideClass)
    }
    // Stryker restore EqualityOperator
  }
}

function* identicalPhase(
  ancestorClasses: readonly number[],
  sideClasses: readonly number[],
  sideIndex: number,
  state: MatchState
): Generator<Matching> {
  if (sideIndex === sideClasses.length) {
    yield* freePhase(ancestorClasses, 0, sideClasses.length, state)
    return
  }
  for (const next of identicalExtensions(
    ancestorClasses,
    sideClasses,
    sideIndex,
    state
  )) {
    yield* identicalPhase(ancestorClasses, sideClasses, sideIndex + 1, next)
  }
}

// Every pairing of a side's copies to the ancestor's that honours "identical
// first": a side copy identical to an unmatched ancestor copy takes one of
// them, the rest pair with any remaining ancestor copy while one exists, only
// the surplus is new.
export const matchings = (
  ancestorClasses: readonly number[],
  sideClasses: readonly number[]
): Generator<Matching> =>
  identicalPhase(ancestorClasses, sideClasses, 0, {
    used: new Set(),
    pairs: [],
    floors: new Map(),
  })

export const valueClasses = (values: readonly JsonValue[]): readonly number[] =>
  values.map(value =>
    values.findIndex(candidate => jsonEqual(candidate, value))
  )

export interface KeyCopies {
  readonly ancestor: readonly JsonObject[]
  readonly local: readonly JsonObject[]
  readonly other: readonly JsonObject[]
}

export interface Pairing {
  readonly ancestor?: JsonObject
  readonly local?: JsonObject
  readonly other?: JsonObject
}

export interface SideGroups<T> {
  readonly ancestor: T[]
  readonly local: T[]
  readonly other: T[]
}

const KEYED_SIDES = ['ancestor', 'local', 'other'] as const

/** Groups what `at` reads for each side's entries by their key. */
export const groupSides = <T>(
  keys: KeyedSides,
  at: (side: (typeof KEYED_SIDES)[number], index: number) => T
): ReadonlyMap<string, SideGroups<T>> => {
  const groups = new Map<string, SideGroups<T>>()
  for (const side of KEYED_SIDES) {
    keys[side].forEach((key, index) => {
      const group = groups.get(key) ?? { ancestor: [], local: [], other: [] }
      group[side].push(at(side, index))
      groups.set(key, group)
    })
  }
  return groups
}

export const groupByKey = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
): ReadonlyMap<string, KeyCopies> => {
  const sides = { ancestor, local, other }
  return groupSides(keys, (side, index) => sides[side][index] as JsonObject)
}

const classesOf = (
  ancestor: readonly JsonObject[],
  side: readonly JsonObject[]
): [readonly number[], readonly number[]] => {
  const classes = valueClasses([...ancestor, ...side])
  return [classes.slice(0, ancestor.length), classes.slice(ancestor.length)]
}

const matchingsOf = (
  ancestor: readonly JsonObject[],
  side: readonly JsonObject[]
): Generator<Matching> => matchings(...classesOf(ancestor, side))

const ancestorPairings = (
  copies: KeyCopies,
  matchedLocal: Matching,
  matchedOther: Matching
): Pairing[] => {
  const pairings: Pairing[] = copies.ancestor.map(ancestor => ({ ancestor }))
  for (const [i, j] of matchedLocal) {
    pairings[i] = { ...pairings[i], local: copies.local[j] }
  }
  for (const [i, j] of matchedOther) {
    pairings[i] = { ...pairings[i], other: copies.other[j] }
  }
  return pairings
}

const unmatched = <T>(
  copies: readonly T[],
  matched: Matching,
  indexOf: (pair: Pair) => number
): readonly T[] =>
  copies.filter((_, index) => !matched.some(pair => indexOf(pair) === index))

const sideOf = ([, side]: Pair): number => side

const surplusPairings = (
  restLocal: readonly JsonObject[],
  restOther: readonly JsonObject[],
  matchedRest: Matching
): Pairing[] => [
  ...matchedRest.map(([i, j]) => ({
    local: restLocal[i],
    other: restOther[j],
  })),
  ...unmatched(restLocal, matchedRest, ([i]) => i).map(local => ({ local })),
  ...unmatched(restOther, matchedRest, ([, j]) => j).map(other => ({ other })),
]

// The longer list is enumerated whichever side it is: which of its copies
// pair is the reading, and it must not depend on the role of the side.
function* surplusMatchings(
  restLocal: readonly JsonObject[],
  restOther: readonly JsonObject[]
): Generator<Matching> {
  if (restLocal.length >= restOther.length) {
    yield* matchingsOf(restLocal, restOther)
    return
  }
  for (const matching of matchingsOf(restOther, restLocal)) {
    yield matching.map(([other, local]): Pair => [local, other])
  }
}

// Every way to read the key's copies as the same entries on the three sides.
export function* readings(copies: KeyCopies): Generator<readonly Pairing[]> {
  for (const matchedLocal of matchingsOf(copies.ancestor, copies.local)) {
    for (const matchedOther of matchingsOf(copies.ancestor, copies.other)) {
      const restLocal = unmatched(copies.local, matchedLocal, sideOf)
      const restOther = unmatched(copies.other, matchedOther, sideOf)
      for (const matchedRest of surplusMatchings(restLocal, restOther)) {
        yield [
          ...ancestorPairings(copies, matchedLocal, matchedOther),
          ...surplusPairings(restLocal, restOther, matchedRest),
        ]
      }
    }
  }
}
