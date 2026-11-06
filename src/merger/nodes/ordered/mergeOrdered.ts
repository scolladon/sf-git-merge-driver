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
import { collapsibleKeys } from './collapsible.js'
import { type ConflictMarks, ConflictSeeds, NO_MARKS } from './conflictSeeds.js'
import { type EntryMerger, type EntryStatus, entryStatuses } from './content.js'
import { type GroupedTies, identityTies } from './identity.js'
import { placeOneSided } from './oneSidedPlacement.js'
import { everyEntry, possiblyMoved } from './orderAxis.js'
import { buildOrderedContext, type OrderedContext } from './orderedContext.js'
import { type LiveSide, type Reading, valueOn } from './orderedEntry.js'
import { mergePartwise } from './partwise.js'
import { placeAgreedInsertions } from './placement.js'
import { cycleMarks, orderOverlaps, tournament } from './precedence.js'
import { type OrderingView, orderingView, phantomSwaps } from './replacement.js'
import {
  combineReadings,
  fewestPhantomSwaps,
  TieScan,
  type Wrapped,
  wholeConflict,
} from './tieCombination.js'
import { tiePartsOf } from './tieParts.js'

export interface OrderedSides {
  readonly ancestor: JsonArray
  readonly local: JsonArray
  readonly other: JsonArray
  readonly keys: KeyedSides
}

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

// One merge stands for its group because the merge treats the exchanged
// copies alike. Three steps carry that and must be re-checked when they
// change: possiblyMoved and notInEveryLis give a group's dropped copies one
// flag, relations between insertions both sides agreed map copy for copy, and
// the readings of a group count equal phantom swaps.
const mergeRepresentatives = (
  wrapped: Wrapped,
  representatives: Iterable<Reading>,
  merge: (reading: Reading) => MergedReading
): MergeResult | null => {
  const merged: MergedReading[] = []
  for (const reading of representatives) {
    const result = merge(reading)
    // A conflict may come from a block that differs across the group: the
    // whole stream decides, in its own order
    if (result.hasConflict) return null
    merged.push(result)
  }
  return combineReadings(wrapped, fewestPhantomSwaps(merged))
}

interface Tied {
  readonly sides: OrderedSides
  readonly wrapped: Wrapped
  readonly ties: GroupedTies
  readonly merge: (reading: Reading) => MergedReading
}

// Without an interchangeable key every reading is its own group: the stream
// merges them with its early exit
const mergeTied = ({ sides, wrapped, ties, merge }: Tied): MergeResult => {
  const collapsible = collapsibleKeys(sides)
  const grouped =
    collapsible.size === 0
      ? null
      : mergeRepresentatives(wrapped, ties.representatives(collapsible), merge)
  return grouped ?? mergeStream(wrapped, ties.readings(), merge)
}

export const mergeOrderedArrays = (
  sides: OrderedSides,
  attribute: string,
  config: MergeConfig
): MergeResult => {
  const whole = takeWholeSide(sides, attribute)
  // Stryker disable next-line ConditionalExpression: shortcut of the general path: a merge takes the changed side whole (doctrine.test.ts)
  if (whole !== null) return whole
  const wrapped = wrapSides(sides, attribute)
  const ties = identityTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  )
  const parts = tiePartsOf(sides, ties, attribute)
  const merge = (reading: Reading): MergedReading =>
    mergeReading(reading, attribute, config)
  const partwise =
    parts.tied.length >= FEWEST_TIED_PARTS
      ? mergePartwise({ wrapped, ties, parts, merge })
      : null
  return partwise ?? mergeTied({ sides, wrapped, ties, merge })
}
