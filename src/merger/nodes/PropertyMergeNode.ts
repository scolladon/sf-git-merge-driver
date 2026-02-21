import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, noConflict } from '../../types/mergeResult.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { getUniqueSortedProps, wrapWithRootKey } from './nodeUtils.js'

// Merges pure objects property-by-property through child nodes.
// Used by MergeNodeFactory for objects without a key extractor (e.g. valueSet, valueSetDefinition).
// Wraps combined output with its attribute key.
// Iteration logic mirrors AbstractMergeStrategy.mergeChildren.
export class PropertyMergeNode implements MergeNode {
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

    const combined = combineResults(results)
    if (combined.output.length === 0) {
      return noConflict([])
    }
    return wrapWithRootKey(combined, this.attribute)
  }
}
