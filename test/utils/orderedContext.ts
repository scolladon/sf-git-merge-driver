import {
  type ConflictMarks,
  ConflictSeeds,
} from '../../src/merger/nodes/ordered/conflictSeeds.js'
import {
  type EntryStatus,
  entryStatuses,
} from '../../src/merger/nodes/ordered/content.js'
import {
  everyEntry,
  possiblyMoved,
} from '../../src/merger/nodes/ordered/orderAxis.js'
import {
  buildOrderedContext,
  type OrderedContext,
} from '../../src/merger/nodes/ordered/orderedContext.js'
import {
  LIVE_SIDES,
  type LiveSide,
  type Reading,
} from '../../src/merger/nodes/ordered/orderedEntry.js'
import { orderingView } from '../../src/merger/nodes/ordered/replacement.js'
import { ORDERED_ATTRIBUTE, readingsOf } from './orderedTokens.js'

const NEVER_MERGED_ENTRY = () => ({ output: [], hasConflict: true })

export const statusesOf = (reading: Reading): readonly EntryStatus[] => {
  const movedOwn = Object.fromEntries(
    LIVE_SIDES.map(side => [side, possiblyMoved(reading, side, everyEntry)])
  ) as Record<LiveSide, ReadonlySet<number>>
  return entryStatuses({
    reading,
    movedOwn,
    attribute: ORDERED_ATTRIBUTE,
    mergeEntry: NEVER_MERGED_ENTRY,
  })
}

export const contextOf = (
  ancestor: string,
  local: string,
  other: string
): OrderedContext => {
  const [reading] = readingsOf(ancestor, local, other)
  const statuses = statusesOf(reading!)
  return buildOrderedContext(
    reading!,
    statuses,
    orderingView(reading!, statuses)
  )
}

export const keysOf = (
  ctx: OrderedContext,
  ids: Iterable<number>
): readonly string[] =>
  [...ids].map(id => (ctx.entries[id] as { key: string }).key)

// A class is named by its smallest id, so that two join lists inducing the
// same partition give equal results whichever id each one picks as the root
export const seededClasses = (
  marks: ConflictMarks,
  size: number
): { classes: number[]; marked: boolean[] } => {
  const seeds = new ConflictSeeds(size)
  seeds.apply(marks)
  const smallestOfRoot = new Map<number, number>()
  const classes = Array.from({ length: size }, (_, id) => {
    const root = seeds.root(id)
    if (!smallestOfRoot.has(root)) smallestOfRoot.set(root, id)
    return smallestOfRoot.get(root) as number
  })
  const marked = Array.from({ length: size }, (_, id) => seeds.isSeeded(id))
  return { classes, marked }
}
