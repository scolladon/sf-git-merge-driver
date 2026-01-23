import type { MergeResult } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'

export interface ScenarioStrategy {
  execute(context: MergeContext): MergeResult
}
