import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { getUniqueSortedProps, wrapWithRootKey } from './nodeUtils.js'

export class ObjectMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonObject | JsonArray,
    private readonly local: JsonObject | JsonArray,
    private readonly other: JsonObject | JsonArray,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const props = getUniqueSortedProps(this.ancestor, this.local, this.other)
    const results: MergeResult[] = []

    for (const key of props) {
      const ancestorOfKey = this.ancestor?.[key]
      const localOfKey = this.local?.[key]
      const otherOfKey = this.other?.[key]

      const childNode = defaultNodeFactory.createNode(
        ancestorOfKey,
        localOfKey,
        otherOfKey,
        key
      )
      const childResult = childNode.merge(config)

      results.push(childResult)
    }

    return wrapWithRootKey(combineResults(results), this.attribute)
  }
}

export class NestedObjectMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonObject | JsonArray,
    private readonly local: JsonObject | JsonArray,
    private readonly other: JsonObject | JsonArray
  ) {}

  merge(config: MergeConfig): MergeResult {
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)
    return orchestrator.mergeObject(this.ancestor, this.local, this.other)
  }

  mergeWithContext(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    return orchestrator.mergeObject(
      this.ancestor as JsonObject | JsonArray,
      this.local as JsonObject | JsonArray,
      this.other as JsonObject | JsonArray
    )
  }
}
