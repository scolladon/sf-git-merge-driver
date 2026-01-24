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

export class AncestorAndLocalStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const localUnchanged = deepEqual(context.ancestor, context.local)

    if (context.rootKey) {
      const { name, existsInOther } = context.rootKey

      if (!existsInOther && localUnchanged) {
        return noConflict([])
      }

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

      return wrapWithRootKey(this.executeNested(context), name)
    }

    if (localUnchanged) {
      return noConflict([])
    }

    if (context.attribute) {
      return this.executeWithAttribute(context)
    }

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
