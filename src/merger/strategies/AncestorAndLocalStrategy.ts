import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { AbstractAncestorStrategy } from './AbstractAncestorStrategy.js'

export class AncestorAndLocalStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): unknown {
    return context.local
  }

  protected getExistsInSecondary(context: MergeContext): boolean {
    return context.rootKey!.existsInOther
  }

  protected buildConflict(
    context: MergeContext,
    targetObj: JsonObject,
    ancestorObj: JsonObject
  ): JsonArray {
    return buildConflictMarkers(context.config, targetObj, ancestorObj, {})
  }

  protected executeWithAttribute(context: MergeContext): MergeResult {
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
