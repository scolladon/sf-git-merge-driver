import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { toJsonArray } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class OtherOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const content = toJsonArray(context.other as JsonObject | JsonArray)

    // Root level: wrap with key
    if (context.rootKey) {
      return noConflict([{ [context.rootKey.name]: content }])
    }

    // Nested level: return content for parent to wrap
    return noConflict(content)
  }
}
