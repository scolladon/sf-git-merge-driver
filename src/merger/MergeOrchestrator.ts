import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonValue } from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import type { MergeContext, RootKeyInfo } from './MergeContext.js'
import { getScenario } from './MergeScenarioFactory.js'
import {
  defaultNodeFactory,
  type MergeNodeFactory,
} from './nodes/MergeNodeFactory.js'
import { getScenarioStrategy } from './strategies/ScenarioStrategy.js'
import { ContestedTagOrder } from './tagOrder/contestedTagOrder.js'
import { TagOrderCache } from './tagOrder/tagOrderCache.js'

export class MergeOrchestrator {
  private readonly tagOrders = new TagOrderCache()

  constructor(
    private readonly config: MergeConfig,
    private readonly nodeFactory: MergeNodeFactory = defaultNodeFactory,
    private readonly contestedTagOrder: ContestedTagOrder = ContestedTagOrder.CONFLICT
  ) {}

  merge(
    ancestor: JsonValue | undefined,
    local: JsonValue | undefined,
    other: JsonValue | undefined,
    rootKey?: RootKeyInfo
  ): MergeResult {
    const scenario = getScenario(ancestor, local, other)
    const strategy = getScenarioStrategy(scenario)

    const context: MergeContext = {
      config: this.config,
      ancestor,
      local,
      other,
      nodeFactory: this.nodeFactory,
      rootKey,
      contestedTagOrder: this.contestedTagOrder,
      tagOrders: this.tagOrders,
    }

    return strategy.execute(context)
  }
}
