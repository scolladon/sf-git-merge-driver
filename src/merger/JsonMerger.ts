import { NamespaceHandler } from '../service/NamespaceHandler.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import type { MergeResult } from '../types/mergeResult.js'
import { combineResults } from '../types/mergeResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MergeOrchestrator } from './MergeOrchestrator.js'
import { defaultNodeFactory } from './nodes/MergeNodeFactory.js'
import { getUniqueSortedProps } from './nodes/nodeUtils.js'

export class JsonMerger {
  private readonly orchestrator: MergeOrchestrator

  constructor(config: MergeConfig) {
    this.orchestrator = new MergeOrchestrator(config, defaultNodeFactory)
  }

  @log
  public mergeThreeWay(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean } {
    const namespaceHandler = new NamespaceHandler()
    const namespaces = namespaceHandler.processNamespaces(
      ancestor,
      local,
      other
    )

    const results: MergeResult[] = []
    const props = getUniqueSortedProps(ancestor, local, other)

    for (const key of props) {
      const result = this.orchestrator.merge(
        ancestor[key],
        local[key],
        other[key],
        undefined,
        {
          name: key,
          existsInLocal: key in local,
          existsInOther: key in other,
        }
      )
      results.push(result)
    }

    const combined = combineResults(results)
    namespaceHandler.addNamespacesToResult(combined.output, namespaces)

    return {
      output: combined.output,
      hasConflict: combined.hasConflict,
    }
  }
}
