import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { getUniqueSortedProps, wrapWithRootKey } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export abstract class AbstractMergeStrategy implements ScenarioStrategy {
  abstract execute(context: MergeContext): MergeResult

  protected mergeChildren(
    context: MergeContext,
    ancestor?: JsonObject | JsonArray
  ): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    const props = getUniqueSortedProps(ancestor ?? {}, local, other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = context.nodeFactory.createNode(
        (ancestor as JsonObject | JsonArray)?.[key],
        local[key],
        other[key],
        key
      )
      const childResult = childNode.merge(context.config)
      results.push(childResult)
    }

    const result = combineResults(results)
    if (context.rootKey) {
      return wrapWithRootKey(result, context.rootKey.name)
    }
    return result
  }
}
