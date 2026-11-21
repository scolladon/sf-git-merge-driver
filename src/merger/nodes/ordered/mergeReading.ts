import type { MergeConfig } from '../../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import { type MergeResult, withConflict } from '../../../types/mergeResult.js'
import { pushAll } from '../../../utils/arrayUtils.js'
import { buildConflictMarkers } from '../../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../../MergeOrchestrator.js'
import { mergeEntryContent, wrapNonEmpty } from '../entryContent.js'
import { defaultNodeFactory } from '../MergeNodeFactory.js'
import { type Ambiguity, withAgreedReplacements } from './agreedReplacement.js'
import { buildBlocks, type OrderedBlock, type OrderedItem } from './blocks.js'
import { type ConflictMarks, ConflictSeeds, NO_MARKS } from './conflictSeeds.js'
import {
  type EntryMerger,
  type EntryStatus,
  entryStatuses,
  type StatusesOf,
} from './content.js'
import { placeOneSided } from './oneSidedPlacement.js'
import { everyEntry, possiblyMoved } from './orderAxis.js'
import { buildOrderedContext, type OrderedContext } from './orderedContext.js'
import { type Reading, valueOn } from './orderedEntry.js'
import type { Side } from './orderedSides.js'
import { placeAgreedInsertions } from './placement.js'
import { cycleMarks, orderOverlaps, tournament } from './precedence.js'
import { type OrderingView, orderingView, phantomSwaps } from './replacement.js'

/** Phantom swaps are only worth counting when readings compete. */
export interface MergedReading extends MergeResult {
  readonly phantomSwaps: () => number
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
  side: Side
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
  config: MergeConfig,
  statusesOf: StatusesOf
): Ambiguity => {
  const movedOwn = {
    local: possiblyMoved(reading, 'local', everyEntry),
    other: possiblyMoved(reading, 'other', everyEntry),
  }
  const statuses = statusesOf({
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

/** One reading through the pipeline: statuses, view, placement, render. */
export const mergeReading = (
  reading: Reading,
  attribute: string,
  config: MergeConfig,
  statusesOf: StatusesOf = entryStatuses
): MergedReading => {
  const ambiguity = settledStatuses(reading, attribute, config, statusesOf)
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
