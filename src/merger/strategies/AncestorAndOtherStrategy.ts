import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import {
  extractContent,
  toJsonArray,
  wrapWithRootKey,
} from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export class AncestorAndOtherStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const otherUnchanged = deepEqual(context.ancestor, context.other)

    if (context.rootKey) {
      const { name, existsInLocal } = context.rootKey

      if (!existsInLocal && otherUnchanged) {
        return noConflict([])
      }

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

      return wrapWithRootKey(this.executeNested(context), name)
    }

    if (otherUnchanged) {
      return noConflict([])
    }

    if (context.attribute) {
      return this.executeWithAttribute(context)
    }

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
