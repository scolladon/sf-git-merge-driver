// The ordered merge before tied readings merged once per group: the reference the per-group merge is checked against.

import { buildConflictMarkers } from '../../../../src/merger/ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../../../../src/merger/MergeOrchestrator.js'
import {
  mergeEntryContent,
  wrapNonEmpty,
} from '../../../../src/merger/nodes/entryContent.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import {
  type Ambiguity,
  withAgreedReplacements,
} from '../../../../src/merger/nodes/ordered/agreedReplacement.js'
import {
  buildBlocks,
  type OrderedBlock,
  type OrderedItem,
} from '../../../../src/merger/nodes/ordered/blocks.js'
import {
  type ConflictMarks,
  ConflictSeeds,
  NO_MARKS,
} from '../../../../src/merger/nodes/ordered/conflictSeeds.js'
import {
  type EntryMerger,
  type EntryStatus,
  entryStatuses,
} from '../../../../src/merger/nodes/ordered/content.js'
import type { MergedReading } from '../../../../src/merger/nodes/ordered/mergeReading.js'
import { placeOneSided } from '../../../../src/merger/nodes/ordered/oneSidedPlacement.js'
import {
  everyEntry,
  possiblyMoved,
} from '../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  buildOrderedContext,
  type OrderedContext,
} from '../../../../src/merger/nodes/ordered/orderedContext.js'
import {
  type LiveSide,
  type Reading,
  valueOn,
} from '../../../../src/merger/nodes/ordered/orderedEntry.js'
import type {
  OrderedSides,
  Wrapped,
} from '../../../../src/merger/nodes/ordered/orderedSides.js'
import { mergePartwise } from '../../../../src/merger/nodes/ordered/partwise.js'
import { placeAgreedInsertions } from '../../../../src/merger/nodes/ordered/placement.js'
import {
  cycleMarks,
  orderOverlaps,
  tournament,
} from '../../../../src/merger/nodes/ordered/precedence.js'
import {
  type OrderingView,
  orderingView,
  phantomSwaps,
} from '../../../../src/merger/nodes/ordered/replacement.js'
import {
  combineReadings,
  fewestPhantomSwaps,
  TieScan,
  wholeConflict,
} from '../../../../src/merger/nodes/ordered/tieCombination.js'
import { tiePartsOf } from '../../../../src/merger/nodes/ordered/tieParts.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'
import {
  type MergeResult,
  noConflict,
  withConflict,
} from '../../../../src/types/mergeResult.js'
import { pushAll } from '../../../../src/utils/arrayUtils.js'
import { jsonIdentical } from '../../../../src/utils/jsonEqual.js'
import { identityTies } from './identity.js'

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

// One tied part is the whole tie set: the parts split nothing.
const FEWEST_TIED_PARTS = 2

const mergeStream = (
  wrapped: Wrapped,
  readings: Iterable<Reading>,
  merge: (reading: Reading) => MergedReading
): MergeResult => {
  const scan = new TieScan()
  for (const reading of readings) {
    scan.add(merge(reading))
    if (scan.isWholeConflict()) return wholeConflict(wrapped)
  }
  return combineReadings(wrapped, fewestPhantomSwaps(scan.readings()))
}

export const mergeOrderedArrays = (
  sides: OrderedSides,
  attribute: string,
  config: MergeConfig
): MergeResult => {
  const whole = takeWholeSide(sides, attribute)
  if (whole !== null) return whole
  const wrapped = wrapSides(sides, attribute)
  const ties = identityTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  )
  const parts = tiePartsOf(sides, ties)
  const merge = (reading: Reading): MergedReading =>
    mergeReading(reading, attribute, config)
  const partwise =
    parts.tied.length >= FEWEST_TIED_PARTS
      ? mergePartwise({ wrapped, ties, parts, merge })
      : null
  return partwise ?? mergeStream(wrapped, ties.readings(), merge)
}
