import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import { pushAll } from '../../../utils/arrayUtils.js'
import { signatureOf } from '../../../utils/jsonSignature.js'
import { type ConflictMarks, completeJoin, type Join } from './conflictSeeds.js'
import type { EntryStatus } from './content.js'
import {
  isOn,
  type LiveSide,
  type OrderedEntry,
  otherSideOf,
  positionOn,
  type Reading,
  writtenOn,
} from './orderedEntry.js'

/**
 * A side that removes entries and inserts others in the same place replaced
 * them (ADR 071): the insertions take the removed entries' place, so that
 * replacements of different entries merge in ancestor order.
 */
export interface ReplacementRun {
  readonly side: LiveSide
  readonly inserted: Reading
  readonly replaced: Reading
}

/**
 * The entries as the order axis reads them: a run whose place is agreed
 * stands where the replaced entries stood. `place` is that ancestor place.
 */
export interface OrderingView {
  readonly view: Reading
  readonly place: ReadonlyMap<number, number>
  readonly marks: ConflictMarks
}

/** Stands for the ancestor, or the other side, holding the replaced entry. */
export const INHERITED_PLACE: JsonObject = Object.freeze({})

interface Stretch {
  readonly previous: OrderedEntry | undefined
  readonly inserted: readonly OrderedEntry[]
  readonly next: OrderedEntry | undefined
}

export const ancestryOf = (reading: Reading): Reading => {
  const ancestry: OrderedEntry[] = []
  for (const entry of reading) {
    // Stryker disable next-line ConditionalExpression: an entry with no ancestor stores at its -1 position, a non-index property no consumer of the array reads
    if (entry.ancestor !== undefined) ancestry[entry.ancestorPos] = entry
  }
  return ancestry
}

/** An insertion of the side alone: agreed insertions are transparent. */
const isOwnInsertion = (entry: OrderedEntry, side: LiveSide): boolean =>
  entry.ancestor === undefined && !isOn(entry, otherSideOf(side))

/** The insertions lying between two consecutive entries the side kept. */
function* stretchesOf(
  sequence: Reading,
  isInserted: (entry: OrderedEntry) => boolean
): Generator<Stretch> {
  let previous: OrderedEntry | undefined
  let inserted: OrderedEntry[] = []
  for (const entry of sequence) {
    if (isInserted(entry)) inserted.push(entry)
    if (entry.ancestor === undefined) continue
    if (inserted.length > 0) yield { previous, inserted, next: entry }
    previous = entry
    inserted = []
  }
  if (inserted.length > 0) yield { previous, inserted, next: undefined }
}

/** The ancestor entries between two kept ones, when the side removed them all. */
const removedBetween = (
  ancestry: Reading,
  side: LiveSide,
  { previous, next }: Stretch
): Reading | undefined => {
  const from = previous === undefined ? 0 : previous.ancestorPos + 1
  const to = next === undefined ? ancestry.length : next.ancestorPos
  const between = ancestry.slice(from, to)
  const removed = between.every(entry => !isOn(entry, side))
  return between.length > 0 && removed ? between : undefined
}

export const isGone = (statuses: readonly EntryStatus[], entry: OrderedEntry) =>
  (statuses[entry.id] as EntryStatus).kind === 'gone'

export interface SettledStretch {
  readonly inserted: readonly OrderedEntry[]
  readonly replaced: Reading
}

/**
 * The stretches where the side inserted entries in place of removed ancestor
 * entries nobody else touches. A replaced entry the other side edited or
 * moved is in conflict (ADR 055): the insertion is then a plain one and only
 * that entry conflicts.
 */
export const settledStretches = (
  reading: Reading,
  statuses: readonly EntryStatus[],
  side: LiveSide,
  isInserted: (entry: OrderedEntry) => boolean
): readonly SettledStretch[] => {
  const ancestry = ancestryOf(reading)
  return Array.from(stretchesOf(writtenOn(reading, side), isInserted)).flatMap(
    stretch => {
      const replaced = removedBetween(ancestry, side, stretch)
      return replaced?.every(entry => isGone(statuses, entry))
        ? [{ inserted: stretch.inserted, replaced }]
        : []
    }
  )
}

export const replacementRuns = (
  reading: Reading,
  statuses: readonly EntryStatus[],
  side: LiveSide
): readonly ReplacementRun[] =>
  settledStretches(reading, statuses, side, entry =>
    isOwnInsertion(entry, side)
  ).map(({ inserted, replaced }) => ({ side, inserted, replaced }))

const positionsOn = (entries: Reading, side: LiveSide): readonly number[] =>
  entries.map(entry => positionOn(entry, side))

const extremes = (positions: readonly number[]) => ({
  first: positions.reduce((low, next) => Math.min(low, next)),
  last: positions.reduce((high, next) => Math.max(high, next)),
})

const firstAbove = (
  sequence: Reading,
  side: LiveSide,
  position: number
): number => {
  let low = 0
  let high = sequence.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (positionOn(sequence[middle] as OrderedEntry, side) <= position) {
      low = middle + 1
    } else high = middle
  }
  return low
}

/** Present entries of the side strictly inside the span the replaced entries held. */
const insertedInside = (
  run: ReplacementRun,
  present: Readonly<Record<LiveSide, Reading>>
): Reading => {
  const other = otherSideOf(run.side)
  const held = positionsOn(
    run.replaced.filter(entry => isOn(entry, other)),
    other
  )
  if (held.length < 2) return []
  const { first, last } = extremes(held)
  const sequence = present[other]
  const start = firstAbove(sequence, other, first)
  const end = firstAbove(sequence, other, last - 1)
  return sequence.slice(start, end)
}

const idsOf = (entries: Reading): readonly number[] =>
  entries.map(entry => entry.id)

interface Contest {
  readonly contested: ReadonlySet<ReplacementRun>
  readonly joins: readonly Join[]
}

type RunPair = readonly [ReplacementRun, ReplacementRun]

const lastReplaced = (run: ReplacementRun): number =>
  (run.replaced.at(-1) as OrderedEntry).ancestorPos

const firstReplaced = (run: ReplacementRun): number =>
  (run.replaced[0] as OrderedEntry).ancestorPos

/** Runs of one side hold disjoint ancestor stretches, in ancestor order. */
const bothSidesReplaced = (
  runs: readonly ReplacementRun[]
): readonly RunPair[] => {
  const local = runs.filter(run => run.side === 'local')
  const other = runs.filter(run => run.side === 'other')
  const pairs: RunPair[] = []
  let left = 0
  let right = 0
  while (left < local.length && right < other.length) {
    const [mine, theirs] = [local[left], other[right]] as RunPair
    if (
      firstReplaced(mine) <= lastReplaced(theirs) &&
      firstReplaced(theirs) <= lastReplaced(mine)
    ) {
      pairs.push([mine, theirs])
    }
    // Stryker disable next-line EqualityOperator: on a tie the runs of each side are disjoint and ordered, so advancing either pointer reaches the same state and pairs
    if (lastReplaced(mine) < lastReplaced(theirs)) left++
    else right++
  }
  return pairs
}

/**
 * A run is contested when its place is ambiguous: the other side inserted
 * inside the replaced span, or replaced a common entry. It stays a plain
 * insertion, joined with what contests it.
 */
const contestsOf = (
  runs: readonly ReplacementRun[],
  present: Readonly<Record<LiveSide, Reading>>
): Contest => {
  const contested = new Set<ReplacementRun>()
  const joins: Join[] = []
  for (const run of runs) {
    const inside = insertedInside(run, present)
    if (inside.length === 0) continue
    contested.add(run)
    pushAll(joins, completeJoin(idsOf(run.inserted), idsOf(inside)))
  }
  for (const [left, right] of bothSidesReplaced(runs)) {
    contested.add(left)
    contested.add(right)
    pushAll(joins, completeJoin(idsOf(left.inserted), idsOf(right.inserted)))
  }
  return { contested, joins }
}

const onSide = (
  entry: OrderedEntry,
  side: LiveSide,
  position: number
): OrderedEntry =>
  side === 'local'
    ? { ...entry, local: INHERITED_PLACE, localPos: position }
    : { ...entry, other: INHERITED_PLACE, otherPos: position }

/**
 * Where the other side holds the replaced entries, the run stands at their
 * place there too: they are unmoved, or the run would be contested.
 */
const placedRun = (run: ReplacementRun): readonly OrderedEntry[] => {
  const other = otherSideOf(run.side)
  const held = positionsOn(
    run.replaced.filter(entry => isOn(entry, other)),
    other
  )
  const ancestorStart = (run.replaced[0] as OrderedEntry).ancestorPos
  const heldFrom = held.length === 0 ? undefined : extremes(held).first
  return run.inserted.map((entry, index) => {
    const share = (index + 1) / (run.inserted.length + 1)
    const inherited = {
      ...entry,
      ancestor: INHERITED_PLACE,
      ancestorPos: ancestorStart + share,
    }
    return heldFrom === undefined
      ? inherited
      : onSide(inherited, other, heldFrom + share)
  })
}

const presentOn = (
  reading: Reading,
  statuses: readonly EntryStatus[]
): Readonly<Record<LiveSide, Reading>> => {
  const present = reading.filter(entry => !isGone(statuses, entry))
  return {
    local: writtenOn(present, 'local'),
    other: writtenOn(present, 'other'),
  }
}

const withoutReplacement = (reading: Reading): OrderingView => ({
  view: reading,
  place: new Map(),
  marks: { joins: [], seeds: [] },
})

export const orderingView = (
  reading: Reading,
  statuses: readonly EntryStatus[]
): OrderingView => {
  const runs = [
    ...replacementRuns(reading, statuses, 'local'),
    ...replacementRuns(reading, statuses, 'other'),
  ]
  if (runs.length === 0) return withoutReplacement(reading)
  const { contested, joins } = contestsOf(runs, presentOn(reading, statuses))
  const placed = runs.filter(run => !contested.has(run)).flatMap(placedRun)
  const byId = new Map(placed.map(entry => [entry.id, entry]))
  return {
    view: reading.map(entry => byId.get(entry.id) ?? entry),
    place: new Map(placed.map(entry => [entry.id, entry.ancestorPos])),
    marks: { joins, seeds: [] },
  }
}

const isSharedAndClean = (
  entry: OrderedEntry,
  statuses: readonly EntryStatus[]
): boolean =>
  isOn(entry, 'local') &&
  isOn(entry, 'other') &&
  (statuses[entry.id] as EntryStatus).kind === 'clean'

const swapsWithin = (copies: Reading): number =>
  copies.reduce(
    (total, first, index) =>
      total +
      copies.slice(index + 1).filter(
        second =>
          // Stryker disable next-line EqualityOperator: distinct shared copies have distinct positions on a side
          first.localPos < second.localPos !==
          // Stryker disable next-line EqualityOperator: distinct shared copies have distinct positions on a side
          first.otherPos < second.otherPos
      ).length,
    0
  )

/**
 * Pairs of interchangeable shared copies the sides order differently. A
 * reading that only works by swapping such copies is not a reading (ADR 068).
 */
export const phantomSwaps = (
  view: Reading,
  statuses: readonly EntryStatus[]
): number => {
  const copies = new Map<string, OrderedEntry[]>()
  for (const entry of view.filter(shared =>
    isSharedAndClean(shared, statuses)
  )) {
    const output = (statuses[entry.id] as { output: JsonArray }).output
    const signature = signatureOf({ output })
    // Stryker disable next-line ArrayDeclaration: a stray string has no positions: both comparisons are false, so it never counts as a swap
    const group = copies.get(signature) ?? []
    group.push(entry)
    copies.set(signature, group)
  }
  return Array.from(copies.values()).reduce(
    (total, group) => total + swapsWithin(group),
    0
  )
}
