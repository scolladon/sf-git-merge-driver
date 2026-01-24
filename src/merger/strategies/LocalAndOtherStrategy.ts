import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import {
  getUniqueSortedProps,
  toJsonArray,
  wrapWithRootKey,
} from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class LocalAndOtherStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    if (deepEqual(local, other)) {
      const content = toJsonArray(other)
      if (context.rootKey) {
        return noConflict([{ [context.rootKey.name]: content }])
      }
      return noConflict(content)
    }

    const result = this.mergeChildren(context)
    if (context.rootKey) {
      return wrapWithRootKey(result, context.rootKey.name)
    }
    return result
  }

  private mergeChildren(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray
    const props = getUniqueSortedProps({}, local, other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = context.nodeFactory.createNode(
        undefined as never,
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
