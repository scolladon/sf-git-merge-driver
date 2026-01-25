import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import {
  buildEarlyResult,
  getUniqueSortedProps,
  wrapWithRootKey,
} from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class AllPresentStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    if (
      deepEqual(context.ancestor, context.local) &&
      deepEqual(context.local, context.other)
    ) {
      return buildEarlyResult(context.local, context.rootKey)
    }

    const result = this.mergeChildren(context)
    if (context.rootKey) {
      return wrapWithRootKey(result, context.rootKey.name)
    }
    return result
  }

  private mergeChildren(context: MergeContext): MergeResult {
    const ancestor = context.ancestor as JsonObject | JsonArray
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray
    const props = getUniqueSortedProps(ancestor, local, other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = context.nodeFactory.createNode(
        ancestor[key],
        local[key],
        other[key],
        key
      )
      const childResult = childNode.merge(context.config)
      results.push(childResult)
    }

    return combineResults(results)
  }
}
