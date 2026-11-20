import type { MergeConfig } from '../../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import {
  type MergeResult,
  noConflict,
  withConflict,
} from '../../../types/mergeResult.js'
import { pushAll } from '../../../utils/arrayUtils.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../../MergeOrchestrator.js'
import { mergeEntryContent, wrapNonEmpty } from '../entryContent.js'
import type { KeyedSides } from '../KeyedArrayIndex.js'
import { defaultNodeFactory } from '../MergeNodeFactory.js'
import { type Ambiguity, withAgreedReplacements } from './agreedReplacement.js'
import { buildBlocks, type OrderedBlock, type OrderedItem } from './blocks.js'
import { type ConflictMarks, ConflictSeeds, NO_MARKS } from './conflictSeeds.js'
import { type EntryMerger, type EntryStatus, entryStatuses } from './content.js'
import { identify } from './identity.js'
import { placeOneSided } from './oneSidedPlacement.js'
import { everyEntry, possiblyMoved } from './orderAxis.js'
import { buildOrderedContext, type OrderedContext } from './orderedContext.js'
import { type LiveSide, type Reading, valueOn } from './orderedEntry.js'
import { placeAgreedInsertions } from './placement.js'
import { cycleMarks, orderOverlaps, tournament } from './precedence.js'
import { type OrderingView, orderingView, phantomSwaps } from './replacement.js'

export interface OrderedSides {
  readonly ancestor: JsonArray
  readonly local: JsonArray
  readonly other: JsonArray
  readonly keys: KeyedSides
}

type Wrapped = Pick<OrderedSides, 'ancestor' | 'local' | 'other'>

const wrapAll = (attribute: string, side: JsonArray): JsonArray =>
  side.map(entry => ({ [attribute]: entry }))

const wrapSides = (sides: OrderedSides, attribute: string): Wrapped => ({
  ancestor: wrapAll(attribute, sides.ancestor),
  local: wrapAll(attribute, sides.local),
  other: wrapAll(attribute, sides.other),
})

// Raw entries, not a key lookup: a repeated key keeps every entry
const takeWholeSide = (
  sides: OrderedSides,
  attribute: string
): MergeResult | null => {
  // Stryker disable ConditionalExpression,LogicalOperator,BlockStatement: shortcut of the general path: a merge takes the changed side whole (doctrine.test.ts)
  if (jsonIdentical(sides.ancestor, sides.local)) {
    return noConflict(wrapAll(attribute, sides.other))
  }
  if (
    jsonIdentical(sides.ancestor, sides.other) ||
    jsonIdentical(sides.local, sides.other)
  ) {
    return noConflict(wrapAll(attribute, sides.local))
    // Stryker restore ConditionalExpression,LogicalOperator,BlockStatement
  }
  return null
}

const entryMerger = (attribute: string, config: MergeConfig): EntryMerger => {
  const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)
  return (ancestor, local, other) =>
    mergeEntryContent(
      { ancestor, local, other },
      attribute,
      config,
      orchestrator,
      wrapNonEmpty
    )
}

const seedsOf = (
  ctx: OrderedContext,
  marks: readonly ConflictMarks[]
): ConflictSeeds => {
  const seeds = new ConflictSeeds(ctx.entries.length)
  const presence = Array.from(ctx.statuses.keys()).filter(
    id => (ctx.statuses[id] as EntryStatus).kind === 'presenceConflict'
  )
  seeds.apply({ ...NO_MARKS, seeds: presence })
  for (const mark of marks) seeds.apply(mark)
  return seeds
}

const statusOutput = (ctx: OrderedContext, id: number): JsonArray =>
  (ctx.statuses[id] as { readonly output: JsonArray }).output

const sideValues = (
  ctx: OrderedContext,
  attribute: string,
  ids: readonly number[],
  side: LiveSide | 'ancestor'
): JsonArray =>
  ids.map(id => {
    const entry = ctx.entries[id] as Reading[number]
    const value = side === 'ancestor' ? entry.ancestor : valueOn(entry, side)
    return { [attribute]: value as JsonObject }
  })

const renderBlock = (
  ctx: OrderedContext,
  attribute: string,
  { local, ancestor, other }: OrderedBlock
): JsonArray => [
  buildConflictMarkers(
    sideValues(ctx, attribute, local, 'local'),
    sideValues(ctx, attribute, ancestor, 'ancestor'),
    sideValues(ctx, attribute, other, 'other')
  ),
]

const renderItem = (
  ctx: OrderedContext,
  attribute: string,
  item: OrderedItem
): JsonArray =>
  'entry' in item
    ? statusOutput(ctx, item.entry)
    : renderBlock(ctx, attribute, item.block)

const renderItems = (
  ctx: OrderedContext,
  attribute: string,
  items: readonly OrderedItem[]
): MergeResult => {
  const output: JsonArray = []
  for (const item of items) pushAll(output, renderItem(ctx, attribute, item))
  return withConflict(output)
}

const renderClean = (
  ctx: OrderedContext,
  output: readonly number[]
): MergeResult => {
  const rendered: JsonArray = []
  for (const id of output) pushAll(rendered, statusOutput(ctx, id))
  const hasConflict = ctx.statuses.some(
    status => status.kind === 'contentConflict'
  )
  return { output: rendered, hasConflict }
}

/** Phantom swaps are only worth counting when readings compete. */
export interface MergedReading extends MergeResult {
  readonly phantomSwaps: () => number
}

const settledStatuses = (
  reading: Reading,
  attribute: string,
  config: MergeConfig
): Ambiguity => {
  const movedOwn = {
    local: possiblyMoved(reading, 'local', everyEntry),
    other: possiblyMoved(reading, 'other', everyEntry),
  }
  const statuses = entryStatuses({
    reading,
    movedOwn,
    attribute,
    mergeEntry: entryMerger(attribute, config),
  })
  return withAgreedReplacements(reading, statuses)
}

interface Placed {
  readonly output: readonly number[]
  readonly seeds: ConflictSeeds
}

const placeEntries = (
  ctx: OrderedContext,
  ordering: OrderingView,
  ambiguity: Ambiguity
): Placed => {
  const precedence = tournament(ctx)
  const agreed = placeAgreedInsertions(ctx, precedence)
  const oneSided = placeOneSided(ctx, agreed.spine)
  const seeds = seedsOf(ctx, [
    orderOverlaps(ctx),
    cycleMarks(precedence),
    agreed.marks,
    oneSided.marks,
    ordering.marks,
    ambiguity.marks,
  ])
  return { output: oneSided.output, seeds }
}

export const mergeReading = (
  reading: Reading,
  attribute: string,
  config: MergeConfig
): MergedReading => {
  const ambiguity = settledStatuses(reading, attribute, config)
  const { statuses } = ambiguity
  const ordering = orderingView(reading, statuses)
  const ctx = buildOrderedContext(reading, statuses, ordering)
  const { output, seeds } = placeEntries(ctx, ordering, ambiguity)
  const swaps = () => phantomSwaps(ordering.view, statuses)
  if (!seeds.hasSeeds()) {
    return { ...renderClean(ctx, output), phantomSwaps: swaps }
  }
  const items = buildBlocks(ctx, output, seeds)
  return { ...renderItems(ctx, attribute, items), phantomSwaps: swaps }
}

const itemsAgree = (
  sides: readonly JsonArray[],
  indexIn: (side: JsonArray) => number
): boolean => {
  const [first] = sides as [JsonArray]
  const reference = first[indexIn(first)]
  return sides.every(side => jsonIdentical(side[indexIn(side)], reference))
}

/**
 * Terminates because the outputs differ: sides cannot all end together while
 * agreeing on every item.
 */
const sharedHead = (sides: readonly JsonArray[]): number => {
  let length = 0
  while (itemsAgree(sides, () => length)) length++
  return length
}

const sharedTail = (sides: readonly JsonArray[], head: number): number => {
  const room = Math.min(...sides.map(side => side.length)) - head
  let length = 0
  const fromEnd = (side: JsonArray) => side.length - length - 1
  while (length < room && itemsAgree(sides, fromEnd)) length++
  return length
}

const middle = (side: JsonArray, head: number, tail: number): JsonArray =>
  side.slice(head, side.length - tail)

const startsAndEndsWith = (
  ancestor: JsonArray,
  head: JsonArray,
  tail: JsonArray
): boolean =>
  head.every((item, index) => jsonIdentical(ancestor[index], item)) &&
  tail.every((item, index) =>
    jsonIdentical(ancestor[ancestor.length - tail.length + index], item)
  )

const trimmedBlock = (
  wrapped: Wrapped,
  outputs: readonly JsonArray[]
): MergeResult => {
  const sides = [...outputs, wrapped.local, wrapped.other]
  const head = sharedHead(sides)
  const tail = sharedTail(sides, head)
  const first = outputs[0] as JsonArray
  const headItems = first.slice(0, head)
  const tailItems = first.slice(first.length - tail)
  const base = startsAndEndsWith(wrapped.ancestor, headItems, tailItems)
    ? middle(wrapped.ancestor, head, tail)
    : wrapped.ancestor
  const block = buildConflictMarkers(
    middle(wrapped.local, head, tail),
    base,
    middle(wrapped.other, head, tail)
  )
  return withConflict([...headItems, block, ...tailItems])
}

const asResult = ({ output, hasConflict }: MergeResult): MergeResult => ({
  output,
  hasConflict,
})

// Among the readings, only those with the fewest swaps of interchangeable
// copies count (ADR 068): the others fabricate a disagreement.
const fewestPhantomSwaps = (
  merged: readonly MergedReading[]
): readonly MergeResult[] => {
  // Stryker disable next-line ConditionalExpression: a lone reading is its own minimum, so the filter keeps it
  if (merged.length === 1) return merged.map(asResult)
  const swaps = merged.map(reading => reading.phantomSwaps())
  const least = Math.min(...swaps)
  return merged.filter((_, index) => swaps[index] === least).map(asResult)
}

const combineReadings = (
  wrapped: Wrapped,
  results: readonly MergeResult[]
): MergeResult => {
  const [first] = results as [MergeResult]
  if (results.every(result => jsonIdentical(result.output, first.output)))
    return first
  if (results.some(result => result.hasConflict)) {
    return withConflict([
      buildConflictMarkers(wrapped.local, wrapped.ancestor, wrapped.other),
    ])
  }
  return trimmedBlock(
    wrapped,
    results.map(result => result.output)
  )
}

export const mergeOrderedArrays = (
  sides: OrderedSides,
  attribute: string,
  config: MergeConfig
): MergeResult => {
  const whole = takeWholeSide(sides, attribute)
  // Stryker disable next-line ConditionalExpression: shortcut of the general path: a merge takes the changed side whole (doctrine.test.ts)
  if (whole !== null) return whole
  const merged = identify(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  ).map(reading => mergeReading(reading, attribute, config))
  return combineReadings(
    wrapSides(sides, attribute),
    fewestPhantomSwaps(merged)
  )
}
