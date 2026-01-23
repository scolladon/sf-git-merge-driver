import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class AncestorOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    // ANCESTOR_ONLY: deleted in both local and other

    // Root level: check if key should exist in result
    if (context.rootKey) {
      const { name, existsInLocal, existsInOther } = context.rootKey
      if (existsInLocal || existsInOther) {
        // Key exists with empty value - preserve empty key
        return noConflict([{ [name]: [] }])
      }
      // Key completely deleted - return nothing
      return noConflict([])
    }

    // Nested level: return empty (deleted)
    return noConflict([])
  }
}
