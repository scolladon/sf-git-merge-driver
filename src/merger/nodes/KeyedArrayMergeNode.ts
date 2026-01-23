import { keyBy } from 'lodash-es'
import { MetadataService } from '../../service/MetadataService.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { combineResults, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { getUniqueSortedProps, toJsonArray } from './nodeUtils.js'

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

    const [keyedAncestor, keyedLocal, keyedOther] = [
      this.ancestor,
      this.local,
      this.other,
    ].map(arr => keyBy(arr, keyField))

    return this.mergeByKeyField(config, keyedAncestor, keyedLocal, keyedOther)
  }

  private mergeByKeyField(
    config: MergeConfig,
    ancestor: JsonObject,
    local: JsonObject,
    other: JsonObject
  ): MergeResult {
    const results: MergeResult[] = []
    const props = getUniqueSortedProps(ancestor, local, other)
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)

    for (const key of props) {
      const ancestorOfKey = ancestor[key] as JsonObject | undefined
      const localOfKey = local[key] as JsonObject | undefined
      const otherOfKey = other[key] as JsonObject | undefined

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
