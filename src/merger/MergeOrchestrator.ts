import { deepEqual } from 'fast-equals'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import { noConflict } from '../types/mergeResult.js'
import { getScenario, MergeScenario } from '../types/mergeScenario.js'
import type { MergeContext, RootKeyInfo } from './MergeContext.js'
import {
  defaultNodeFactory,
  type MergeNodeFactory,
} from './nodes/MergeNodeFactory.js'
import { toJsonArray } from './nodes/nodeUtils.js'
import { getScenarioStrategy } from './strategies/ScenarioStrategyFactory.js'

export class MergeOrchestrator {
  constructor(
    private readonly config: MergeConfig,
    private readonly nodeFactory: MergeNodeFactory = defaultNodeFactory
  ) {}

  merge(
    ancestor: JsonValue,
    local: JsonValue,
    other: JsonValue,
    attribute?: string,
    rootKey?: RootKeyInfo
  ): MergeResult {
    const scenario = getScenario(ancestor, local, other)

    // Early termination: if all three are equal, skip merge
    if (scenario === MergeScenario.ALL) {
      if (deepEqual(ancestor, local) && deepEqual(local, other)) {
        return this.buildEarlyResult(local, rootKey)
      }
    }

    const strategy = getScenarioStrategy(scenario)

    const context: MergeContext = {
      config: this.config,
      ancestor,
      local,
      other,
      attribute,
      nodeFactory: this.nodeFactory,
      rootKey,
    }

    return strategy.execute(context)
  }

  private buildEarlyResult(
    value: JsonValue,
    rootKey?: RootKeyInfo
  ): MergeResult {
    const content = toJsonArray(value as JsonObject | JsonArray)
    if (rootKey) {
      return noConflict([{ [rootKey.name]: content }])
    }
    return noConflict(content)
  }

  mergeObject(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): MergeResult {
    return this.merge(ancestor, local, other)
  }
}
