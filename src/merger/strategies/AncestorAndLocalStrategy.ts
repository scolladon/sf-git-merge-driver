import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { toJsonArray } from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

const extractContent = (arr: JsonArray): JsonObject | JsonArray => {
  return (arr.length === 1 ? arr[0] : arr) as JsonObject | JsonArray
}

export class AncestorAndLocalStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const localUnchanged = deepEqual(context.ancestor, context.local)

    // Root level handling
    if (context.rootKey) {
      const { name, existsInOther } = context.rootKey

      // Other key missing and local unchanged = other deletion wins
      if (!existsInOther && localUnchanged) {
        return noConflict([])
      }

      // Other key missing and local changed = conflict at root level
      if (!existsInOther && !localUnchanged) {
        const localObj = {
          [name]: toJsonArray(context.local as JsonObject | JsonArray),
        }
        const ancestorObj = {
          [name]: toJsonArray(context.ancestor as JsonObject | JsonArray),
        }
        return withConflict(
          buildConflictMarkers(context.config, localObj, ancestorObj, {})
        )
      }

      // Other key exists with empty value - delegate to nested merge, wrap result
      const result = this.executeNested(context)
      if (result.output.length > 0) {
        return {
          output: [{ [name]: result.output }],
          hasConflict: result.hasConflict,
        }
      }
      // Empty result but key exists - preserve empty key
      return noConflict([{ [name]: [] }])
    }

    // Nested level: local unchanged means return empty (other deleted)
    if (localUnchanged) {
      return noConflict([])
    }

    // Nested level with attribute (keyed array element)
    if (context.attribute) {
      return this.executeWithAttribute(context)
    }

    // Nested level conflict
    return withConflict(
      buildConflictMarkers(
        context.config,
        extractContent(toJsonArray(context.local as JsonObject | JsonArray)),
        extractContent(toJsonArray(context.ancestor as JsonObject | JsonArray)),
        {}
      )
    )
  }

  private executeNested(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    return orchestrator.merge(context.ancestor, context.local, context.other)
  }

  private executeWithAttribute(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    const localResult = orchestrator.merge({}, context.local, {}, undefined)
    const ancestorResult = orchestrator.merge(
      {},
      context.ancestor,
      {},
      undefined
    )

    const localProp = { [context.attribute!]: localResult.output }
    const ancestorProp = { [context.attribute!]: ancestorResult.output }

    return withConflict(
      buildConflictMarkers(context.config, localProp, ancestorProp, {})
    )
  }
}
