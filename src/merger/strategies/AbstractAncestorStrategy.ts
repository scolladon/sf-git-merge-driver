import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import {
  extractContent,
  toJsonArray,
  wrapWithRootKey,
} from '../nodes/nodeUtils.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

export abstract class AbstractAncestorStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const target = this.getTarget(context)
    const targetUnchanged = deepEqual(context.ancestor, target)

    if (context.rootKey) {
      const { name } = context.rootKey
      const existsInSecondary = this.getExistsInSecondary(context)

      if (!existsInSecondary && targetUnchanged) {
        return noConflict([])
      }

      if (!existsInSecondary && !targetUnchanged) {
        const targetObj = {
          [name]: toJsonArray(target as JsonObject | JsonArray),
        }
        const ancestorObj = {
          [name]: toJsonArray(context.ancestor as JsonObject | JsonArray),
        }
        return withConflict(this.buildConflict(context, targetObj, ancestorObj))
      }

      return wrapWithRootKey(this.executeNested(context), name)
    }

    if (targetUnchanged) {
      return noConflict([])
    }

    if (context.attribute) {
      return this.executeWithAttribute(context)
    }

    return withConflict(
      this.buildConflict(
        context,
        extractContent(toJsonArray(target as JsonObject | JsonArray)),
        extractContent(toJsonArray(context.ancestor as JsonObject | JsonArray))
      )
    )
  }

  protected abstract getTarget(context: MergeContext): unknown

  protected abstract getExistsInSecondary(context: MergeContext): boolean

  protected abstract buildConflict(
    context: MergeContext,
    targetObj: JsonObject | JsonArray,
    ancestorObj: JsonObject | JsonArray
  ): JsonArray

  private executeNested(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    return orchestrator.merge(context.ancestor, context.local, context.other)
  }

  protected abstract executeWithAttribute(context: MergeContext): MergeResult
}
