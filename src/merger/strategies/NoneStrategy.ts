import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class NoneStrategy implements ScenarioStrategy {
  execute(_context: MergeContext): MergeResult {
    // NONE scenario: nothing exists anywhere, return empty
    return noConflict([])
  }
}
