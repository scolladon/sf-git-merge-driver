import type { MergeConfig } from '../../types/conflictTypes.js'
import {
  getJsonProp,
  type JsonArray,
  type JsonObject,
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
    const props = getUniqueSortedProps(this.ancestor, this.local, this.other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = defaultNodeFactory.createNode(
        getJsonProp(this.ancestor, key),
        getJsonProp(this.local, key),
        getJsonProp(this.other, key),
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
