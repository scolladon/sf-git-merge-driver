import type { MergeConfig } from '../types/conflictTypes.js'
import {
  type JsonArray,
  type JsonObject,
  toJsonObjectOrEmpty,
} from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import { combineResults } from '../types/mergeResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MergeOrchestrator } from './MergeOrchestrator.js'
import { getUniqueSortedProps } from './mergePropertyKeys.js'
import { defaultNodeFactory } from './nodes/MergeNodeFactory.js'

export class JsonMerger {
  private readonly orchestrator: MergeOrchestrator

  constructor(config: MergeConfig) {
    this.orchestrator = new MergeOrchestrator(config, defaultNodeFactory)
  }

  @log('JsonMerger')
  public mergeThreeWay(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean } {
    // Narrow once up front so the per-key loop can index directly without
    // paying for Array.isArray on every property access (hot path —
    // observed >20% cost on ordered-merge benches).
    const ancestorObj = toJsonObjectOrEmpty(ancestor)
    const localObj = toJsonObjectOrEmpty(local)
    const otherObj = toJsonObjectOrEmpty(other)

    const results: MergeResult[] = []
    const props = getUniqueSortedProps(ancestor, local, other)

    for (const key of props) {
      const result = this.orchestrator.merge(
        ancestorObj[key],
        localObj[key],
        otherObj[key],
        undefined,
        {
          name: key,
          existsInLocal: key in localObj,
          existsInOther: key in otherObj,
        }
      )
      results.push(result)
    }

    const combined = combineResults(results)
    return {
      output: combined.output,
      hasConflict: combined.hasConflict,
    }
  }
}
