import type { MergeConfig } from '../../types/conflictTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'

/**
 * Each MergeNode.merge() returns output already wrapped with its attribute key.
 * For example, a TextMergeNode for attribute "field" returns
 * `[{ field: [{ #text: 'value' }] }]`, not raw `[{ #text: 'value' }]`.
 * This contract prevents double-wrapping by parent nodes.
 */
export interface MergeNode {
  merge(config: MergeConfig): MergeResult
}
