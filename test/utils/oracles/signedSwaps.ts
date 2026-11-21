import type { EntryStatus } from '../../../src/merger/nodes/ordered/content.js'
import {
  isOn,
  type OrderedEntry,
  type Reading,
} from '../../../src/merger/nodes/ordered/orderedEntry.js'
import type { JsonArray } from '../../../src/types/jsonTypes.js'
import { signatureOf } from '../../../src/utils/jsonSignature.js'

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
      copies
        .slice(index + 1)
        .filter(
          second =>
            first.localPos < second.localPos !==
            first.otherPos < second.otherPos
        ).length,
    0
  )

/**
 * Pairs of interchangeable shared copies the sides order differently. A
 * reading that only works by swapping such copies is not a reading.
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
    const group = copies.get(signature) ?? []
    group.push(entry)
    copies.set(signature, group)
  }
  return Array.from(copies.values()).reduce(
    (total, group) => total + swapsWithin(group),
    0
  )
}
