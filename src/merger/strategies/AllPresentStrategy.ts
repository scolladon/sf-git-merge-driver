import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { buildEarlyResult } from '../nodes/nodeUtils.js'
import { AbstractMergeStrategy } from './AbstractMergeStrategy.js'

export class AllPresentStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    if (
      deepEqual(context.ancestor, context.local) &&
      deepEqual(context.local, context.other)
    ) {
      return buildEarlyResult(context.local, context.rootKey)
    }

    return this.mergeChildren(
      context,
      context.ancestor as JsonObject | JsonArray
    )
  }
}
