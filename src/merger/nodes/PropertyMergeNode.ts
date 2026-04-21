import type { MergeConfig } from '../../types/conflictTypes.js'
import {
  type JsonArray,
  type JsonObject,
  toJsonObjectOrEmpty,
} from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  wrapWithRootKey,
} from '../../types/mergeResult.js'
import { getUniqueSortedProps } from '../mergePropertyKeys.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'

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
    // One-shot narrowing keeps the per-key loop allocation-free.
    const ancestorObj = toJsonObjectOrEmpty(this.ancestor)
    const localObj = toJsonObjectOrEmpty(this.local)
    const otherObj = toJsonObjectOrEmpty(this.other)
    const props = getUniqueSortedProps(this.ancestor, this.local, this.other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = defaultNodeFactory.createNode(
        ancestorObj[key],
        localObj[key],
        otherObj[key],
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
