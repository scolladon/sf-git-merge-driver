import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeNode } from './MergeNode.js'
import { generateObj } from './nodeUtils.js'

const compareItems = (a: JsonValue, b: JsonValue): number => {
  const strA = String(a)
  const strB = String(b)
  if (strA < strB) return -1
  if (strA > strB) return 1
  return 0
}

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
    const resultItems: JsonValue[] = []
    const seen = new Set<JsonValue>()

    for (const item of this.ancestor) {
      if (seen.has(item)) continue
      seen.add(item)
      if (localSet.has(item) && otherSet.has(item)) {
        resultItems.push(item)
      }
    }

    for (const item of this.local) {
      if (seen.has(item)) continue
      seen.add(item)
      resultItems.push(item)
    }

    for (const item of this.other) {
      if (seen.has(item)) continue
      seen.add(item)
      resultItems.push(item)
    }

    resultItems.sort(compareItems)
    const merged = resultItems.map(item => generateObj(item, this.attribute))

    return noConflict(merged)
  }
}
