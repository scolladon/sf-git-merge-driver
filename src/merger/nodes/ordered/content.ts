import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import type { MergeResult } from '../../../types/mergeResult.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import {
  isOn,
  LIVE_SIDES,
  type LiveSide,
  type OrderedEntry,
  type Reading,
  valueOn,
} from './orderedEntry.js'

export type EntryStatus =
  | { readonly kind: 'clean'; readonly output: JsonArray }
  | { readonly kind: 'gone' }
  | { readonly kind: 'presenceConflict' }
  | { readonly kind: 'contentConflict'; readonly output: JsonArray }

export type EntryMerger = (
  ancestor: JsonObject | undefined,
  local: JsonObject,
  other: JsonObject
) => MergeResult

export interface StatusInput {
  readonly reading: Reading
  readonly movedOwn: Readonly<Record<LiveSide, ReadonlySet<number>>>
  readonly attribute: string
  readonly mergeEntry: EntryMerger
}

const GONE: EntryStatus = { kind: 'gone' }
export const PRESENCE_CONFLICT: EntryStatus = { kind: 'presenceConflict' }

const clean = (attribute: string, value: JsonObject): EntryStatus => ({
  kind: 'clean',
  output: [{ [attribute]: value }],
})

const fromMerge = (result: MergeResult): EntryStatus =>
  result.hasConflict
    ? { kind: 'contentConflict', output: result.output }
    : { kind: 'clean', output: result.output }

const keptByAllStatus = (
  entry: OrderedEntry,
  input: StatusInput
): EntryStatus => {
  const { ancestor, local, other } = entry as Required<OrderedEntry>
  if (jsonIdentical(local, ancestor)) return clean(input.attribute, other)
  if (jsonIdentical(other, ancestor) || jsonIdentical(local, other)) {
    return clean(input.attribute, local)
  }
  return fromMerge(input.mergeEntry(ancestor, local, other))
}

const deletedBySideStatus = (
  entry: OrderedEntry,
  input: StatusInput
): EntryStatus => {
  const keeper = LIVE_SIDES.find(side => isOn(entry, side)) as LiveSide
  if (!jsonIdentical(valueOn(entry, keeper), entry.ancestor)) {
    return PRESENCE_CONFLICT
  }
  return input.movedOwn[keeper].has(entry.id) ? PRESENCE_CONFLICT : GONE
}

const insertedStatus = (
  entry: OrderedEntry,
  input: StatusInput
): EntryStatus => {
  const { local, other } = entry
  if (local === undefined || other === undefined) {
    return clean(input.attribute, (local ?? other) as JsonObject)
  }
  if (jsonIdentical(local, other)) return clean(input.attribute, local)
  return fromMerge(input.mergeEntry(undefined, local, other))
}

const statusOf = (entry: OrderedEntry, input: StatusInput): EntryStatus => {
  if (entry.ancestor === undefined) return insertedStatus(entry, input)
  const liveSides = LIVE_SIDES.filter(side => isOn(entry, side)).length
  if (liveSides === 2) return keptByAllStatus(entry, input)
  return liveSides === 0 ? GONE : deletedBySideStatus(entry, input)
}

export const entryStatuses = (input: StatusInput): readonly EntryStatus[] =>
  input.reading.map(entry => statusOf(entry, input))
