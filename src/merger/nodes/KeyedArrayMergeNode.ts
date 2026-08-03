import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { jsonEqual } from '../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { KeyExtractor } from './KeyedArrayIndex.js'
import { indexKeyedArrays } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { OrderedKeyedArrayMergeStrategy } from './OrderedKeyedArrayMergeStrategy.js'

// ============================================================================
// Unkeyed Conflict Strategy
// ============================================================================

// No key extractor means individual elements can't be matched across
// versions, so a genuine divergence still falls back to a whole-array
// conflict (documented in the README). But without a same-as-every-other-
// node-type equality check first, this used to conflict unconditionally —
// including when the array itself never changed and only forced a
// recursive walk because an unrelated sibling property differed.
class UnkeyedConflictStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(_config: MergeConfig): MergeResult {
    if (
      jsonEqual(this.ancestor, this.local) &&
      jsonEqual(this.local, this.other)
    ) {
      return this.resolved(this.local)
    }
    if (jsonEqual(this.ancestor, this.local)) {
      return this.resolved(this.other)
    }
    if (jsonEqual(this.ancestor, this.other)) {
      return this.resolved(this.local)
    }
    if (jsonEqual(this.local, this.other)) {
      return this.resolved(this.local)
    }

    return withConflict([
      buildConflictMarkers(
        { [this.attribute]: this.local },
        { [this.attribute]: this.ancestor },
        { [this.attribute]: this.other }
      ),
    ])
  }

  private resolved(value: JsonArray): MergeResult {
    return noConflict(value.map(item => ({ [this.attribute]: item })))
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
    // Fused single-pass traversal — one keyField() call per item instead of
    // two (previously: collectAllKeys + buildKeyedMap both invoked keyField).
    const { keyedAncestor, keyedLocal, keyedOther, allKeys } = indexKeyedArrays(
      this.ancestor,
      this.local,
      this.other,
      this.keyField
    )

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
