import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { getUniqueSortedProps, toJsonArray } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class LocalAndOtherStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    // If identical, return other
    if (deepEqual(local, other)) {
      const content = toJsonArray(other)

      // Root level: wrap with key
      if (context.rootKey) {
        return noConflict([{ [context.rootKey.name]: content }])
      }

      return noConflict(content)
    }

    // Different - merge children
    const result = this.mergeChildren(context)

    // Root level: wrap result with key
    if (context.rootKey) {
      if (result.output.length > 0) {
        return {
          output: [{ [context.rootKey.name]: result.output }],
          hasConflict: result.hasConflict,
        }
      }
      // Empty result but keys exist - preserve empty key
      return noConflict([{ [context.rootKey.name]: [] }])
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
