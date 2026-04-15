import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeNode } from './MergeNode.js'

const compareItems = (a: JsonValue, b: JsonValue): number =>
  String(a).localeCompare(String(b))

export class TextArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(_config: MergeConfig): MergeResult {
    const localSet = new Set(this.local)
    const otherSet = new Set(this.other)
    const ancestorSet = new Set(this.ancestor)

    const resultItems = new Set<JsonValue>()
    for (const item of this.ancestor) {
      if (localSet.has(item) && otherSet.has(item)) resultItems.add(item)
    }
    for (const item of this.local) {
      if (!ancestorSet.has(item)) resultItems.add(item)
    }
    for (const item of this.other) {
      if (!ancestorSet.has(item)) resultItems.add(item)
    }

    const merged = [...resultItems]
      .sort(compareItems)
      .map(item => (item == null ? {} : { [this.attribute]: item }))

    return noConflict(merged)
  }
}
