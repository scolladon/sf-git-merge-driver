import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { KeyExtractor } from './KeyedArrayIndex.js'
import { buildKeyedMap } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { OrderedKeyedArrayMergeStrategy } from './OrderedKeyedArrayMergeStrategy.js'

// ============================================================================
// Unkeyed Conflict Strategy
// ============================================================================

class UnkeyedConflictStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(_config: MergeConfig): MergeResult {
    return withConflict([
      buildConflictMarkers(
        { [this.attribute]: this.local },
        { [this.attribute]: this.ancestor },
        { [this.attribute]: this.other }
      ),
    ])
  }
}

// ============================================================================
// Unordered Strategy
// ============================================================================

class UnorderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor
  ) {}

  merge(config: MergeConfig): MergeResult {
    const allKeys = this.collectAllKeys()
    const keyedAncestor = buildKeyedMap(this.ancestor, this.keyField)
    const keyedLocal = buildKeyedMap(this.local, this.keyField)
    const keyedOther = buildKeyedMap(this.other, this.keyField)

    const results: MergeResult[] = []
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)

    for (const key of Array.from(allKeys).sort()) {
      const result = orchestrator.merge(
        keyedAncestor.get(key) ?? {},
        keyedLocal.get(key) ?? {},
        keyedOther.get(key) ?? {},
        this.attribute
      )

      if (result.output.length > 0) {
        results.push({
          output: [{ [this.attribute]: result.output }],
          hasConflict: result.hasConflict,
        })
      }
    }

    return combineResults(results)
  }

  private collectAllKeys(): Set<string> {
    const allKeys = new Set<string>()
    for (const arr of [this.ancestor, this.local, this.other]) {
      for (const item of arr) {
        allKeys.add(this.keyField(item as JsonObject))
      }
    }
    return allKeys
  }
}

// ============================================================================
// KeyedArrayMergeNode
// ============================================================================

export class KeyedArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor | undefined,
    private readonly isOrdered: boolean
  ) {}

  merge(config: MergeConfig): MergeResult {
    if (!this.keyField) {
      return new UnkeyedConflictStrategy(
        this.ancestor,
        this.local,
        this.other,
        this.attribute
      ).merge(config)
    }

    const strategy: KeyedArrayMergeStrategy = this.isOrdered
      ? new OrderedKeyedArrayMergeStrategy(
          this.ancestor,
          this.local,
          this.other,
          this.attribute,
          this.keyField
        )
      : new UnorderedKeyedArrayMergeStrategy(
          this.ancestor,
          this.local,
          this.other,
          this.attribute,
          this.keyField
        )

    return strategy.merge(config)
  }
}
