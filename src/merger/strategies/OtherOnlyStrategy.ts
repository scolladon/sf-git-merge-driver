import type { MergeResult } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { buildEarlyResult } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class OtherOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    return buildEarlyResult(context.other, context.rootKey)
  }
}
