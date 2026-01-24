import { isEmpty } from 'lodash-es'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { getUniqueSortedProps } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class AllPresentStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const result = this.mergeChildren(context)

    // Root level: wrap result with key
    if (context.rootKey) {
      if (!isEmpty(result.output)) {
        return {
          output: [{ [context.rootKey.name]: result.output }],
          hasConflict: result.hasConflict,
        }
      }
      // Empty result but key exists - preserve empty key
      return {
        output: [{ [context.rootKey.name]: [] }],
        hasConflict: result.hasConflict,
      }
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
