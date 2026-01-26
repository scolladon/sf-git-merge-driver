import type { MergeConfig } from '../../types/conflictTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'

export interface MergeNode {
  merge(config: MergeConfig): MergeResult
}
