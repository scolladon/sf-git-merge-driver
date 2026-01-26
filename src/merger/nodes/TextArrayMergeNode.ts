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
    const ancestorSet = new Set(this.ancestor)

    const resultItems = new Set([
      ...this.ancestor.filter(item => localSet.has(item) && otherSet.has(item)),
      ...this.local.filter(item => !ancestorSet.has(item)),
      ...this.other.filter(item => !ancestorSet.has(item)),
    ])

    const merged = [...resultItems]
      .sort(compareItems)
      .map(item => generateObj(item, this.attribute))

    return noConflict(merged)
  }
}
