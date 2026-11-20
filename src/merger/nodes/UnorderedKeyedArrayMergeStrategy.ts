import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { takeFirst } from '../../utils/iteratorUtils.js'
import { jsonEqual, jsonIdentical } from '../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { mergeElementPresence } from './elementPresence.js'
import { type Entries, mergeEntryContent } from './entryContent.js'
import type { KeyedSides } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'
import type { KeyCopies, Pairing } from './keyedReadings.js'
import { groupByKey, readings } from './keyedReadings.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'

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
