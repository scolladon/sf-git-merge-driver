import { isNil } from 'lodash-es'
import { TEXT_TAG } from '../../constant/parserConstant.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { MergeNode } from './MergeNode.js'

const generateObj = (value: JsonValue | null, attrib: string): JsonObject => {
  return isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] }
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

    // Find elements removed in each branch
    const removedInLocal = this.ancestor.filter(item => !localSet.has(item))
    const removedInOther = this.ancestor.filter(item => !otherSet.has(item))
    const removedSet = new Set([...removedInLocal, ...removedInOther])

    // Merge: union of all, minus removed elements, sorted
    const merged = [
      ...new Set([...this.ancestor, ...this.local, ...this.other]),
    ]
      .filter(item => !removedSet.has(item))
      .sort()
      .map(item => generateObj(item, this.attribute))

    return noConflict(merged)
  }
}
