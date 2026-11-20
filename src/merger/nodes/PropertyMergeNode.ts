import type { MergeConfig } from '../../types/conflictTypes.js'
import {
  type JsonObject,
  type JsonValue,
  toJsonObjectOrEmpty,
} from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  wrapWithRootKey,
} from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { getScenario } from '../MergeScenarioFactory.js'
import { mergePropertyOrder } from '../tagOrder/mergePropertyOrder.js'
import { blockAt } from '../tagOrder/propertyOrderConflict.js'
import { type ElementSides, mergeElementPresence } from './elementPresence.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'

// Merges pure objects property-by-property through child nodes.
// Used by MergeNodeFactory for objects without a key extractor (e.g. valueSet, valueSetDefinition).
// Wraps combined output with its attribute key.
// Iteration logic mirrors AbstractMergeStrategy.mergeChildren.
export class PropertyMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonValue | undefined,
    private readonly local: JsonValue | undefined,
    private readonly other: JsonValue | undefined,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    return (
      mergeElementPresence(this.sides(), this.attribute) ??
      this.mergeProperties(config)
    )
  }

  // A single method per level holds the loop: every extra frame between two
  // nested nodes lowers the depth a document can reach before the stack ends.
  // An absent ancestor is passed as undefined, never as a stand-in object:
  // a plain {} would resolve `constructor` through Object.prototype and
  // resurrect a deleted child.
  private mergeProperties(config: MergeConfig): MergeResult {
    const ancestor = this.presentAncestor()
    const local = toJsonObjectOrEmpty(this.local)
    const other = toJsonObjectOrEmpty(this.other)
    const merged = mergePropertyOrder(ancestor, local, other)
    const results: MergeResult[] = []
    for (const key of merged.order) {
      const block = blockAt(merged, key, { ancestor, local, other })
      if (block) {
        results.push(block)
        continue
      }
      const childNode = defaultNodeFactory.createNode(
        ancestor?.[key],
        local[key],
        other[key],
        key
      )
      results.push(childNode.merge(config))
    }
    return this.wrapped(combineResults(results))
  }

  private wrapped(combined: MergeResult): MergeResult {
    if (combined.output.length === 0) {
      return noConflict([])
    }
    return wrapWithRootKey(combined, this.attribute)
  }

  private presentAncestor(): JsonObject | undefined {
    const scenario = getScenario(this.ancestor, this.local, this.other)
    return scenario === MergeScenario.ALL
      ? toJsonObjectOrEmpty(this.ancestor)
      : undefined
  }

  private sides(): ElementSides {
    return { ancestor: this.ancestor, local: this.local, other: this.other }
  }
}
