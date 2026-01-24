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

// Comparator for sorting - handles null/undefined by converting to string
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

    // Single pass: collect items that should be in result
    // An item is included if:
    // - It exists in local or other (union)
    // - AND it wasn't removed (existed in ancestor but not in local/other)
    const resultItems: JsonValue[] = []
    const seen = new Set<JsonValue>()

    for (const item of this.ancestor) {
      if (seen.has(item)) continue
      seen.add(item)
      // Keep if present in both local and other (not removed by either)
      if (localSet.has(item) && otherSet.has(item)) {
        resultItems.push(item)
      }
    }

    // Items from local not yet seen are new additions (not in ancestor)
    for (const item of this.local) {
      if (seen.has(item)) continue
      seen.add(item)
      resultItems.push(item)
    }

    // Items from other not yet seen are new additions (not in ancestor)
    for (const item of this.other) {
      if (seen.has(item)) continue
      seen.add(item)
      resultItems.push(item)
    }

    // Sort and transform in single pass using reduce
    resultItems.sort(compareItems)
    const merged = resultItems.map(item => generateObj(item, this.attribute))

    return noConflict(merged)
  }
}
