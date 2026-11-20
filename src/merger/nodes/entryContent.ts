import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonObject } from '../../types/jsonTypes.js'
import { type MergeResult, noConflict } from '../../types/mergeResult.js'
import type { MergeOrchestrator } from '../MergeOrchestrator.js'
import { TextMergeNode } from './TextMergeNode.js'
import { isWholeValueTrio } from './valueKind.js'

export interface Entries {
  readonly ancestor: JsonObject | undefined
  readonly local: JsonObject | undefined
  readonly other: JsonObject | undefined
}

export type NestedWrapper = (
  merged: MergeResult,
  attribute: string
) => MergeResult

const wrapNested: NestedWrapper = (merged, attribute) => ({
  output: [{ [attribute]: merged.output }],
  hasConflict: merged.hasConflict,
})

// An entry whose content merges away leaves nothing to wrap.
export const wrapNonEmpty: NestedWrapper = (merged, attribute) =>
  merged.output.length === 0 ? noConflict([]) : wrapNested(merged, attribute)

export const mergeEntryContent = (
  { ancestor, local, other }: Entries,
  attribute: string,
  config: MergeConfig,
  orchestrator: MergeOrchestrator,
  wrapper: NestedWrapper = wrapNested
): MergeResult => {
  if (isWholeValueTrio(ancestor, local, other)) {
    return new TextMergeNode(ancestor, local, other, attribute).merge(config)
  }
  return wrapper(orchestrator.merge(ancestor ?? {}, local, other), attribute)
}
