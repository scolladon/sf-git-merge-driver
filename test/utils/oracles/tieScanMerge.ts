// The ordered merge that walks every tied reading as one stream: the
// reference the part-by-part merge across cuts is checked against.

import { buildConflictMarkers } from '../../../src/merger/ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../../../src/merger/MergeOrchestrator.js'
import {
  mergeEntryContent,
  wrapNonEmpty,
} from '../../../src/merger/nodes/entryContent.js'
import type { KeyedSides } from '../../../src/merger/nodes/KeyedArrayIndex.js'
import { defaultNodeFactory } from '../../../src/merger/nodes/MergeNodeFactory.js'
import {
  type Ambiguity,
  withAgreedReplacements,
} from '../../../src/merger/nodes/ordered/agreedReplacement.js'
import {
  buildBlocks,
  type OrderedBlock,
  type OrderedItem,
} from '../../../src/merger/nodes/ordered/blocks.js'
import {
  type ConflictMarks,
  ConflictSeeds,
  NO_MARKS,
} from '../../../src/merger/nodes/ordered/conflictSeeds.js'
import {
  type EntryMerger,
  type EntryStatus,
  entryStatuses,
} from '../../../src/merger/nodes/ordered/content.js'
import type {
  MergedReading,
  OrderedSides,
} from '../../../src/merger/nodes/ordered/mergeOrdered.js'
import { placeOneSided } from '../../../src/merger/nodes/ordered/oneSidedPlacement.js'
import {
  everyEntry,
  possiblyMoved,
} from '../../../src/merger/nodes/ordered/orderAxis.js'
import {
  buildOrderedContext,
  type OrderedContext,
} from '../../../src/merger/nodes/ordered/orderedContext.js'
import {
  type LiveSide,
  type Reading,
  valueOn,
} from '../../../src/merger/nodes/ordered/orderedEntry.js'
import { placeAgreedInsertions } from '../../../src/merger/nodes/ordered/placement.js'
import {
  cycleMarks,
  orderOverlaps,
  tournament,
} from '../../../src/merger/nodes/ordered/precedence.js'
import {
  type OrderingView,
  orderingView,
  phantomSwaps,
} from '../../../src/merger/nodes/ordered/replacement.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../src/types/jsonTypes.js'
import {
  type MergeResult,
  noConflict,
  withConflict,
} from '../../../src/types/mergeResult.js'
import { pushAll } from '../../../src/utils/arrayUtils.js'
import { jsonIdentical } from '../../../src/utils/jsonEqual.js'
import { identify } from './enumeratedIdentity.js'

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
  if (jsonIdentical(sides.ancestor, sides.local)) {
    return noConflict(wrapAll(attribute, sides.other))
  }
  if (
    jsonIdentical(sides.ancestor, sides.other) ||
    jsonIdentical(sides.local, sides.other)
  ) {
    return noConflict(wrapAll(attribute, sides.local))
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

const once = (count: () => number): (() => number) => {
  let counted: number | undefined
  return () => (counted ??= count())
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

const mergeReading = (
  reading: Reading,
  attribute: string,
  config: MergeConfig
): MergedReading => {
  const ambiguity = settledStatuses(reading, attribute, config)
  const { statuses } = ambiguity
  const ordering = orderingView(reading, statuses)
  const ctx = buildOrderedContext(reading, statuses, ordering)
  const { output, seeds } = placeEntries(ctx, ordering, ambiguity)
  const swaps = once(() => phantomSwaps(ordering.view, statuses))
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
// copies count: the others fabricate a disagreement.
const fewestPhantomSwaps = (
  merged: readonly MergedReading[]
): readonly MergeResult[] => {
  if (merged.length === 1) return merged.map(asResult)
  const swaps = merged.map(reading => reading.phantomSwaps())
  const least = Math.min(...swaps)
  return merged.filter((_, index) => swaps[index] === least).map(asResult)
}

// No reading has fewer than zero swaps: once one has none, the readings with
// none are exactly those fewestPhantomSwaps keeps, whatever comes later.
class TieScan {
  private readonly merged: MergedReading[] = []
  private first: JsonArray | undefined
  private differs = false
  private conflicts = false

  add(reading: MergedReading): void {
    this.merged.push(reading)
    // A lone reading is never measured, as fewestPhantomSwaps leaves it.
    if (this.merged.length === 2) this.see(this.merged[0])
    if (this.merged.length >= 2) this.see(reading)
  }

  // combineReadings would build the block of the whole array, which reads the
  // sides only.
  isWholeConflict(): boolean {
    return this.differs && this.conflicts
  }

  readings(): readonly MergedReading[] {
    return this.merged
  }

  private see(reading: MergedReading): void {
    if (reading.phantomSwaps() !== 0) return
    this.conflicts ||= reading.hasConflict
    if (this.first === undefined) this.first = reading.output
    else this.differs ||= !jsonIdentical(reading.output, this.first)
  }
}

const wholeConflict = (wrapped: Wrapped): MergeResult =>
  withConflict([
    buildConflictMarkers(wrapped.local, wrapped.ancestor, wrapped.other),
  ])

const combineReadings = (
  wrapped: Wrapped,
  results: readonly MergeResult[]
): MergeResult => {
  const [first] = results as [MergeResult]
  if (results.every(result => jsonIdentical(result.output, first.output)))
    return first
  if (results.some(result => result.hasConflict)) return wholeConflict(wrapped)
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
  if (whole !== null) return whole
  const wrapped = wrapSides(sides, attribute)
  const scan = new TieScan()
  const { ancestor, local, other, keys } = sides
  for (const reading of identify(ancestor, local, other, keys)) {
    scan.add(mergeReading(reading, attribute, config))
    if (scan.isWholeConflict()) return wholeConflict(wrapped)
  }
  return combineReadings(wrapped, fewestPhantomSwaps(scan.readings()))
}
