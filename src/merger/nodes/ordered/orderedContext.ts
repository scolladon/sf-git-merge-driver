import type { EntryStatus } from './content.js'
import { isKeptByAll, possiblyMoved } from './orderAxis.js'
import {
  isOn,
  LIVE_SIDES,
  type LiveSide,
  type OrderedEntry,
  positionOn,
  type Reading,
  writtenOn,
} from './orderedEntry.js'
import type { OrderingView } from './replacement.js'

const NO_NEIGHBOUR = -1

interface SharedNeighbours {
  readonly previous: Int32Array
  readonly next: Int32Array
}

/**
 * `entries` are the entries as the sides wrote them: contents, block spans
 * (`written`) and the base use them. Everything on the order axis reads the
 * `view`, where a replacement stands at the place of what it replaced.
 */
export interface OrderedContext {
  readonly entries: Reading
  readonly view: Reading
  readonly statuses: readonly EntryStatus[]
  readonly written: Readonly<Record<LiveSide, Reading>>
  readonly place: ReadonlyMap<number, number>
  readonly sequence: Readonly<Record<LiveSide, Reading>>
  readonly indexIn: Readonly<Record<LiveSide, ReadonlyMap<number, number>>>
  readonly keptByAll: Reading
  readonly agreed: Reading
  readonly moved: Readonly<Record<LiveSide, ReadonlySet<number>>>
  readonly sharedNeighbours: Readonly<Record<LiveSide, SharedNeighbours>>
}

const isShared = (entry: OrderedEntry): boolean =>
  LIVE_SIDES.every(side => isOn(entry, side))

const isAgreed = (entry: OrderedEntry): boolean =>
  entry.ancestor === undefined && isShared(entry)

const classified = (present: Reading) => ({
  keptByAll: present.filter(isKeptByAll),
  agreed: present.filter(isAgreed),
})

const sequenceOn = (present: Reading, side: LiveSide): Reading =>
  present
    .filter(entry => isOn(entry, side))
    .sort((left, right) => positionOn(left, side) - positionOn(right, side))

const nearestShared = (
  sequence: Reading,
  indexes: Iterable<number>
): Int32Array => {
  const nearest = new Int32Array(sequence.length)
  let last = NO_NEIGHBOUR
  for (const index of indexes) {
    nearest[index] = last
    const entry = sequence[index] as OrderedEntry
    if (isShared(entry)) last = entry.id
  }
  return nearest
}

const sharedNeighboursOf = (sequence: Reading): SharedNeighbours => ({
  previous: nearestShared(sequence, sequence.keys()),
  next: nearestShared(sequence, Array.from(sequence.keys()).reverse()),
})

const indexOf = (sequence: Reading): ReadonlyMap<number, number> =>
  new Map(sequence.map((entry, index) => [entry.id, index]))

const perSide = <T>(
  build: (side: LiveSide) => T
): Readonly<Record<LiveSide, T>> => ({
  local: build('local'),
  other: build('other'),
})

const presentIn = (
  entries: Reading,
  statuses: readonly EntryStatus[]
): Reading =>
  entries.filter(entry => (statuses[entry.id] as EntryStatus).kind !== 'gone')

const writtenSequences = (
  entries: Reading,
  statuses: readonly EntryStatus[]
): Readonly<Record<LiveSide, Reading>> => {
  const present = presentIn(entries, statuses)
  return perSide(side => writtenOn(present, side))
}

export const buildOrderedContext = (
  entries: Reading,
  statuses: readonly EntryStatus[],
  { view, place }: Pick<OrderingView, 'view' | 'place'>
): OrderedContext => {
  const present = presentIn(view, statuses)
  const sequence = perSide(side => sequenceOn(present, side))
  return {
    entries,
    view,
    statuses,
    written: view === entries ? sequence : writtenSequences(entries, statuses),
    place,
    sequence,
    indexIn: perSide(side => indexOf(sequence[side])),
    ...classified(present),
    moved: perSide(side => possiblyMoved(view, side, isKeptByAll)),
    sharedNeighbours: perSide(side => sharedNeighboursOf(sequence[side])),
  }
}

export const isExplicitNeighbour = (
  ctx: OrderedContext,
  neighbour: OrderedEntry,
  entry: OrderedEntry,
  side: LiveSide
): boolean => {
  const index = ctx.indexIn[side].get(entry.id) as number
  const { previous, next } = ctx.sharedNeighbours[side]
  return previous[index] === neighbour.id || next[index] === neighbour.id
}
