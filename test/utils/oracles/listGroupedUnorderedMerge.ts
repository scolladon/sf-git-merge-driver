import { buildConflictMarkers } from '../../../src/merger/ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../../../src/merger/MergeOrchestrator.js'
import { mergeElementPresence } from '../../../src/merger/nodes/elementPresence.js'
import {
  type Entries,
  mergeEntryContent,
} from '../../../src/merger/nodes/entryContent.js'
import type { KeyedSides } from '../../../src/merger/nodes/KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from '../../../src/merger/nodes/KeyedArrayMergeStrategy.js'
import type {
  KeyCopies,
  Pairing,
  SideGroups,
} from '../../../src/merger/nodes/keyedReadings.js'
import { readings } from '../../../src/merger/nodes/keyedReadings.js'
import { defaultNodeFactory } from '../../../src/merger/nodes/MergeNodeFactory.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../src/types/jsonTypes.js'
import type { MergeResult } from '../../../src/types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../../src/types/mergeResult.js'
import { takeFirst } from '../../../src/utils/iteratorUtils.js'
import { jsonEqual, jsonIdentical } from '../../../src/utils/jsonEqual.js'

const KEYED_SIDES = ['ancestor', 'local', 'other'] as const

/** Groups what `at` reads for each side's entries by their key. */
const groupSides = <T>(
  keys: KeyedSides,
  at: (side: (typeof KEYED_SIDES)[number], index: number) => T
): ReadonlyMap<string, SideGroups<T>> => {
  const groups = new Map<string, SideGroups<T>>()
  for (const side of KEYED_SIDES) {
    keys[side].forEach((key, index) => {
      const group = groups.get(key) ?? { ancestor: [], local: [], other: [] }
      group[side].push(at(side, index))
      groups.set(key, group)
    })
  }
  return groups
}

export const groupByKey = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
): ReadonlyMap<string, KeyCopies> => {
  const sides = { ancestor, local, other }
  return groupSides(keys, (side, index) => sides[side][index] as JsonObject)
}

const isSingleCopy = ({ ancestor, local, other }: KeyCopies): boolean =>
  ancestor.length <= 1 && local.length <= 1 && other.length <= 1

const sortedItems = (result: MergeResult): string[] =>
  result.output.map(item => JSON.stringify(item)).sort()

const sameItems = (left: MergeResult, right: MergeResult): boolean =>
  jsonEqual(sortedItems(left), sortedItems(right))

export class UnorderedKeyedArrayMergeStrategy
  implements KeyedArrayMergeStrategy
{
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keys: KeyedSides
  ) {}

  merge(config: MergeConfig): MergeResult {
    const groups = groupByKey(this.ancestor, this.local, this.other, this.keys)
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)
    const results = Array.from(groups.keys())
      .sort()
      .map(key =>
        this.mergeKey(config, orchestrator, groups.get(key) as KeyCopies)
      )
    return combineResults(results)
  }

  private mergeKey(
    config: MergeConfig,
    orchestrator: MergeOrchestrator,
    copies: KeyCopies
  ): MergeResult {
    if (isSingleCopy(copies)) {
      return this.mergeEntry(config, orchestrator, {
        ancestor: copies.ancestor[0],
        local: copies.local[0],
        other: copies.other[0],
      })
    }
    return (
      this.takeAgreedCopies(copies) ??
      this.mergeRepeatedKey(config, orchestrator, copies)
    )
  }

  private takeAgreedCopies({
    ancestor,
    local,
    other,
  }: KeyCopies): MergeResult | null {
    if (jsonIdentical(local, other)) return noConflict(this.wrapAll(local))
    if (jsonIdentical(ancestor, local)) return noConflict(this.wrapAll(other))
    if (jsonIdentical(ancestor, other)) return noConflict(this.wrapAll(local))
    return null
  }

  private wrapAll(entries: readonly JsonObject[]): JsonArray {
    return entries.map(entry => this.wrap(entry))
  }

  private mergeEntry(
    config: MergeConfig,
    orchestrator: MergeOrchestrator,
    entries: Entries
  ): MergeResult {
    return (
      this.takeAgreedSide(entries) ??
      mergeElementPresence(entries, this.attribute) ??
      mergeEntryContent(entries, this.attribute, config, orchestrator)
    )
  }

  // The key is clean only when every identity reading merges clean to the
  // same entries; otherwise its copies are one block, as written.
  private mergeRepeatedKey(
    config: MergeConfig,
    orchestrator: MergeOrchestrator,
    copies: KeyCopies
  ): MergeResult {
    const pairings = readings(copies)
    const first = this.mergeReading(config, orchestrator, takeFirst(pairings))
    if (first.hasConflict) return this.keyConflict(copies)
    for (const reading of pairings) {
      const outcome = this.mergeReading(config, orchestrator, reading)
      if (outcome.hasConflict || !sameItems(outcome, first)) {
        return this.keyConflict(copies)
      }
    }
    return first
  }

  private mergeReading(
    config: MergeConfig,
    orchestrator: MergeOrchestrator,
    reading: readonly Pairing[]
  ): MergeResult {
    return combineResults(
      reading.map(({ ancestor, local, other }) =>
        this.mergeEntry(config, orchestrator, { ancestor, local, other })
      )
    )
  }

  private keyConflict({ ancestor, local, other }: KeyCopies): MergeResult {
    return withConflict([
      buildConflictMarkers(
        this.wrapAll(local),
        this.wrapAll(ancestor),
        this.wrapAll(other)
      ),
    ])
  }

  // A side that changed nothing defers to the other; two agreeing sides are
  // taken as written. Entries are compared directly, never wrapped.
  private takeAgreedSide({
    ancestor,
    local,
    other,
  }: Entries): MergeResult | null {
    if (jsonIdentical(local, other)) return this.verbatim(local)
    if (jsonIdentical(ancestor, local)) return this.verbatim(other)
    if (jsonIdentical(ancestor, other)) return this.verbatim(local)
    return null
  }

  private verbatim(entry: JsonObject | undefined): MergeResult {
    return noConflict(entry === undefined ? [] : [this.wrap(entry)])
  }

  private wrap(entry: JsonObject): JsonObject {
    return { [this.attribute]: entry }
  }
}
