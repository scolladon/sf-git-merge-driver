import type { MergeConfig } from '../types/conflictTypes.js'
import {
  getJsonProp,
  type JsonArray,
  type JsonObject,
} from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import { combineResults } from '../types/mergeResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MergeOrchestrator } from './MergeOrchestrator.js'
import { getUniqueSortedProps } from './mergePropertyKeys.js'
import { defaultNodeFactory } from './nodes/MergeNodeFactory.js'

const existsAt = (value: JsonObject | JsonArray, key: string): boolean =>
  !Array.isArray(value) && key in value

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
    const results: MergeResult[] = []
    const props = getUniqueSortedProps(ancestor, local, other)

    for (const key of props) {
      const result = this.orchestrator.merge(
        getJsonProp(ancestor, key),
        getJsonProp(local, key),
        getJsonProp(other, key),
        undefined,
        {
          name: key,
          existsInLocal: existsAt(local, key),
          existsInOther: existsAt(other, key),
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
