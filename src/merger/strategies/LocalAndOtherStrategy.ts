import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import type { MergeContext } from '../MergeContext.js'
import { buildEarlyResult } from '../nodes/nodeUtils.js'
import { AbstractMergeStrategy } from './AbstractMergeStrategy.js'

export class LocalAndOtherStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    if (deepEqual(local, other)) {
      return buildEarlyResult(local, context.rootKey)
    }

    return this.mergeChildren(context, undefined)
  }
}
