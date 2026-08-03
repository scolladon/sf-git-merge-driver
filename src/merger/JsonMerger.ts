import type { MergeConfig } from '../types/conflictTypes.js'
import {
  type JsonArray,
  type JsonObject,
  type JsonValue,
  toJsonObjectOrEmpty,
} from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import { combineResults } from '../types/mergeResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MergeOrchestrator } from './MergeOrchestrator.js'
import { mergePropertyOrder } from './mergePropertyOrder.js'
import { defaultNodeFactory } from './nodes/MergeNodeFactory.js'

// `obj[key]` also walks the prototype chain (e.g. `{}['constructor']`
// resolves to the inherited Object constructor) — key is an untrusted
// XML tag name, so an own-property guard is needed here too, not just
// on the `in` check below.
const getOwnProperty = (obj: JsonObject, key: string): JsonValue | undefined =>
  Object.hasOwn(obj, key) ? obj[key] : undefined

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
    const props = mergePropertyOrder(ancestor, local, other)

    for (const key of props) {
      const result = this.orchestrator.merge(
        getOwnProperty(ancestorObj, key),
        getOwnProperty(localObj, key),
        getOwnProperty(otherObj, key),
        undefined,
        {
          name: key,
          existsInLocal: Object.hasOwn(localObj, key),
          existsInOther: Object.hasOwn(otherObj, key),
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
