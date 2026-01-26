import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class AncestorOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    if (context.rootKey) {
      const { name, existsInLocal, existsInOther } = context.rootKey
      if (existsInLocal || existsInOther) {
        return noConflict([{ [name]: [] }])
      }
      return noConflict([])
    }
    return noConflict([])
  }
}
