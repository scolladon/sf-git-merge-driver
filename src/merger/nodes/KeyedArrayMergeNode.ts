import { isEmpty } from 'lodash-es'
import { MetadataService } from '../../service/MetadataService.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import type { KeyExtractor } from './nodeUtils.js'
import { buildKeyedMap, toJsonArray } from './nodeUtils.js'
import type { KeyedArrayMergeStrategy } from './OrderedKeyedArrayMergeStrategy.js'
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

  merge(config: MergeConfig): MergeResult {
    const unwrap = (arr: JsonArray) =>
      (arr.length === 1 ? arr[0] : arr) as JsonObject | JsonArray

    return withConflict(
      buildConflictMarkers(
        config,
        unwrap(toJsonArray({ [this.attribute]: this.local })),
        unwrap(toJsonArray({ [this.attribute]: this.ancestor })),
        unwrap(toJsonArray({ [this.attribute]: this.other }))
      )
    )
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

      if (!isEmpty(result.output)) {
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
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const keyField = MetadataService.getKeyFieldExtractor(this.attribute)

    if (!keyField) {
      return new UnkeyedConflictStrategy(
        this.ancestor,
        this.local,
        this.other,
        this.attribute
      ).merge(config)
    }

    const args = [
      this.ancestor,
      this.local,
      this.other,
      this.attribute,
      keyField,
    ] as const

    const strategy = MetadataService.isOrderedAttribute(this.attribute)
      ? new OrderedKeyedArrayMergeStrategy(...args)
      : new UnorderedKeyedArrayMergeStrategy(...args)

    return strategy.merge(config)
  }
}
