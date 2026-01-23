import { MetadataService } from '../../service/MetadataService.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { toJsonArray } from './nodeUtils.js'

type KeyExtractor = (item: JsonObject) => string

// Build a Map from array using key extractor, collecting keys into provided Set
const buildKeyedMap = (
  arr: JsonArray,
  keyField: KeyExtractor,
  keysSet: Set<string>
): Map<string, JsonObject> => {
  const map = new Map<string, JsonObject>()
  for (const item of arr) {
    const key = keyField(item as JsonObject)
    map.set(key, item as JsonObject)
    keysSet.add(key)
  }
  return map
}

export class KeyedArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const keyField = MetadataService.getKeyFieldExtractor(this.attribute)

    if (!keyField) {
      const localContent = toJsonArray({ [this.attribute]: this.local })
      const ancestorContent = toJsonArray({ [this.attribute]: this.ancestor })
      const otherContent = toJsonArray({ [this.attribute]: this.other })

      const localObj = (
        localContent.length === 1 ? localContent[0] : localContent
      ) as JsonObject | JsonArray
      const ancestorObj = (
        ancestorContent.length === 1 ? ancestorContent[0] : ancestorContent
      ) as JsonObject | JsonArray
      const otherObj = (
        otherContent.length === 1 ? otherContent[0] : otherContent
      ) as JsonObject | JsonArray

      return withConflict(
        buildConflictMarkers(config, localObj, ancestorObj, otherObj)
      )
    }

    // Build maps and collect unique keys in a single pass per array
    const allKeys = new Set<string>()
    const keyedAncestor = buildKeyedMap(this.ancestor, keyField, allKeys)
    const keyedLocal = buildKeyedMap(this.local, keyField, allKeys)
    const keyedOther = buildKeyedMap(this.other, keyField, allKeys)

    // Sort keys once
    const sortedKeys = Array.from(allKeys).sort()

    const results: MergeResult[] = []
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)

    for (const key of sortedKeys) {
      const ancestorOfKey = keyedAncestor.get(key)
      const localOfKey = keyedLocal.get(key)
      const otherOfKey = keyedOther.get(key)

      const result = orchestrator.merge(
        ancestorOfKey ?? {},
        localOfKey ?? {},
        otherOfKey ?? {},
        this.attribute
      )

      // istanbul ignore else -- defensive: all current conflict strategies return non-empty output
      if (result.output.length > 0) {
        results.push({
          output: [{ [this.attribute]: result.output }],
          hasConflict: result.hasConflict,
        })
      } else if (result.hasConflict) {
        results.push(result)
      }
    }

    return combineResults(results)
  }
}
