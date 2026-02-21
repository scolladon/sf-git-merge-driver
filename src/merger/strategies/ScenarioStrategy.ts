import { deepEqual } from 'fast-equals'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import {
  buildEarlyResult,
  extractContent,
  getUniqueSortedProps,
  toJsonArray,
  wrapWithRootKey,
} from '../nodes/nodeUtils.js'

// ============================================================================
// Strategy Interface
// ============================================================================

export interface ScenarioStrategy {
  execute(context: MergeContext): MergeResult
}

// ============================================================================
// Abstract Base Classes
// ============================================================================

abstract class AbstractMergeStrategy implements ScenarioStrategy {
  abstract execute(context: MergeContext): MergeResult

  protected mergeChildren(
    context: MergeContext,
    ancestor?: JsonObject | JsonArray
  ): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    const props = getUniqueSortedProps(ancestor ?? {}, local, other)
    const results: MergeResult[] = []

    for (const key of props) {
      const childNode = context.nodeFactory.createNode(
        (ancestor as JsonObject | JsonArray)?.[key],
        local[key],
        other[key],
        key
      )
      const childResult = childNode.merge(context.config)
      results.push(childResult)
    }

    const result = combineResults(results)
    if (context.rootKey) {
      return wrapWithRootKey(result, context.rootKey.name)
    }
    return result
  }
}

abstract class AbstractAncestorStrategy implements ScenarioStrategy {
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

// ============================================================================
// Concrete Strategy Classes
// ============================================================================

class NoneStrategy implements ScenarioStrategy {
  execute(_context: MergeContext): MergeResult {
    return noConflict([])
  }
}

class OtherOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    return buildEarlyResult(context.other, context.rootKey)
  }
}

class LocalOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    return buildEarlyResult(context.local, context.rootKey)
  }
}

class LocalAndOtherStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    if (deepEqual(local, other)) {
      return buildEarlyResult(local, context.rootKey)
    }

    return this.mergeChildren(context, undefined)
  }
}

class AncestorOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    if (context.rootKey) {
      const { name, existsInLocal, existsInOther } = context.rootKey
      if (existsInLocal || existsInOther) {
        return noConflict([{ [name]: [] }])
      }
      return noConflict([])
    }
    return noConflict([])
  }
}

class AncestorAndLocalStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): unknown {
    return context.local
  }

  protected getExistsInSecondary(context: MergeContext): boolean {
    return context.rootKey!.existsInOther
  }

  protected buildConflict(
    context: MergeContext,
    targetObj: JsonObject,
    ancestorObj: JsonObject
  ): JsonArray {
    return buildConflictMarkers(context.config, targetObj, ancestorObj, {})
  }

  protected executeWithAttribute(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    const localResult = orchestrator.merge({}, context.local, {}, undefined)
    const ancestorResult = orchestrator.merge(
      {},
      context.ancestor,
      {},
      undefined
    )

    const localProp = { [context.attribute!]: localResult.output }
    const ancestorProp = {
      [context.attribute!]: ancestorResult.output,
    }

    return withConflict(
      buildConflictMarkers(context.config, localProp, ancestorProp, {})
    )
  }
}

class AncestorAndOtherStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): unknown {
    return context.other
  }

  protected getExistsInSecondary(context: MergeContext): boolean {
    return context.rootKey!.existsInLocal
  }

  protected buildConflict(
    context: MergeContext,
    targetObj: JsonObject | JsonArray,
    ancestorObj: JsonObject | JsonArray
  ): JsonArray {
    return buildConflictMarkers(context.config, {}, ancestorObj, targetObj)
  }

  protected executeWithAttribute(context: MergeContext): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    const ancestorResult = orchestrator.merge(
      {},
      context.ancestor,
      {},
      undefined
    )
    const otherResult = orchestrator.merge({}, {}, context.other, undefined)

    const ancestorProp = {
      [context.attribute!]: ancestorResult.output,
    }
    const otherProp = { [context.attribute!]: otherResult.output }

    return withConflict(
      buildConflictMarkers(context.config, {}, ancestorProp, otherProp)
    )
  }
}

class AllPresentStrategy extends AbstractMergeStrategy {
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

// ============================================================================
// Strategy Factory
// ============================================================================

let strategies: Record<MergeScenario, ScenarioStrategy> | null = null

const getStrategies = (): Record<MergeScenario, ScenarioStrategy> => {
  if (!strategies) {
    strategies = {
      [MergeScenario.NONE]: new NoneStrategy(),
      [MergeScenario.OTHER_ONLY]: new OtherOnlyStrategy(),
      [MergeScenario.LOCAL_ONLY]: new LocalOnlyStrategy(),
      [MergeScenario.LOCAL_AND_OTHER]: new LocalAndOtherStrategy(),
      [MergeScenario.ANCESTOR_ONLY]: new AncestorOnlyStrategy(),
      [MergeScenario.ANCESTOR_AND_OTHER]: new AncestorAndOtherStrategy(),
      [MergeScenario.ANCESTOR_AND_LOCAL]: new AncestorAndLocalStrategy(),
      [MergeScenario.ALL]: new AllPresentStrategy(),
    }
  }
  return strategies
}

export const getScenarioStrategy = (
  scenario: MergeScenario
): ScenarioStrategy => {
  return getStrategies()[scenario]
}
