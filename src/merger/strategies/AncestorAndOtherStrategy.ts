import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { AbstractAncestorStrategy } from './AbstractAncestorStrategy.js'

export class AncestorAndOtherStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): unknown {
    return context.other
  }

  protected getExistsInSecondary(context: MergeContext): boolean {
    return context.rootKey!.existsInLocal
  }

  protected buildConflict(
    context: MergeContext,
    targetObj: JsonObject | JsonArray,
    ancestorObj: JsonObject | JsonArray
  ): JsonArray {
    return buildConflictMarkers(context.config, {}, ancestorObj, targetObj)
  }

  protected executeWithAttribute(context: MergeContext): MergeResult {
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
