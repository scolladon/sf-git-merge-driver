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
