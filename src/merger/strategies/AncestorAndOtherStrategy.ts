import { deepEqual } from 'fast-equals'
import { isEmpty } from 'lodash-es'
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

export class AncestorAndOtherStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const otherUnchanged = deepEqual(context.ancestor, context.other)

    // Root level handling
    if (context.rootKey) {
      const { name, existsInLocal } = context.rootKey

      // Local key missing and other unchanged = local deletion wins
      if (!existsInLocal && otherUnchanged) {
        return noConflict([])
      }

      // Local key missing and other changed = conflict at root level
      if (!existsInLocal && !otherUnchanged) {
        const ancestorObj = {
          [name]: toJsonArray(context.ancestor as JsonObject | JsonArray),
        }
        const otherObj = {
          [name]: toJsonArray(context.other as JsonObject | JsonArray),
        }
        return withConflict(
          buildConflictMarkers(context.config, {}, ancestorObj, otherObj)
        )
      }

      // Local key exists with empty value - delegate to nested merge, wrap result
      const result = this.executeNested(context)
      if (!isEmpty(result.output)) {
        return {
          output: [{ [name]: result.output }],
          hasConflict: result.hasConflict,
        }
      }
      // Empty result but key exists - preserve empty key
      return noConflict([{ [name]: [] }])
    }

    // Nested level: other unchanged means return empty (local deleted)
    if (otherUnchanged) {
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
        {},
        extractContent(toJsonArray(context.ancestor as JsonObject | JsonArray)),
        extractContent(toJsonArray(context.other as JsonObject | JsonArray))
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
    const ancestorResult = orchestrator.merge(
      {},
      context.ancestor,
      {},
      undefined
    )
    const otherResult = orchestrator.merge({}, {}, context.other, undefined)

    const ancestorProp = { [context.attribute!]: ancestorResult.output }
    const otherProp = { [context.attribute!]: otherResult.output }

    return withConflict(
      buildConflictMarkers(context.config, {}, ancestorProp, otherProp)
    )
  }
}
