import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import type { MergeContext, RootKeyInfo } from './MergeContext.js'
import { getScenario } from './MergeScenarioFactory.js'
import {
  defaultNodeFactory,
  type MergeNodeFactory,
} from './nodes/MergeNodeFactory.js'
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

  mergeObject(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): MergeResult {
    return this.merge(ancestor, local, other)
  }
}
