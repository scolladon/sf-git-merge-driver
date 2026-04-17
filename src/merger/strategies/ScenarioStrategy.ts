import {
  getJsonProp,
  type JsonArray,
  type JsonObject,
} from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  buildEarlyResult,
  combineResults,
  noConflict,
  withConflict,
  wrapWithRootKey,
} from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { jsonEqual } from '../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext, RootKeyInfo } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { getUniqueSortedProps } from '../mergePropertyKeys.js'

// ============================================================================
// Strategy Interface
// ============================================================================

interface ScenarioStrategy {
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
        ancestor === undefined ? undefined : getJsonProp(ancestor, key),
        getJsonProp(local, key),
        getJsonProp(other, key),
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
    const targetUnchanged = jsonEqual(context.ancestor, target)

    if (context.rootKey) {
      return this.executeWithRootKey(
        context,
        context.rootKey,
        target,
        targetUnchanged
      )
    }

    return this.executeWithoutRootKey(context, target, targetUnchanged)
  }

  private executeWithRootKey(
    context: MergeContext,
    rootKey: RootKeyInfo,
    target: unknown,
    targetUnchanged: boolean
  ): MergeResult {
    const { name } = rootKey
    const existsInSecondary = this.getExistsInSecondary(rootKey)

    if (!existsInSecondary && targetUnchanged) {
      return noConflict([])
    }

    if (!existsInSecondary) {
      const targetObj = { [name]: target as JsonObject | JsonArray }
      const ancestorObj = {
        [name]: context.ancestor as JsonObject | JsonArray,
      }
      return withConflict(this.buildConflict(context, targetObj, ancestorObj))
    }

    return wrapWithRootKey(this.executeNested(context), name)
  }

  private executeWithoutRootKey(
    context: MergeContext,
    target: unknown,
    targetUnchanged: boolean
  ): MergeResult {
    if (targetUnchanged) {
      return noConflict([])
    }

    if (context.attribute) {
      return this.executeWithAttribute(context, context.attribute)
    }

    return withConflict(
      this.buildConflict(
        context,
        target as JsonObject | JsonArray,
        context.ancestor as JsonObject | JsonArray
      )
    )
  }

  protected abstract getTarget(context: MergeContext): unknown

  protected abstract getExistsInSecondary(rootKey: RootKeyInfo): boolean

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

  private executeWithAttribute(
    context: MergeContext,
    attribute: string
  ): MergeResult {
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    const targetResult = this.mergeTarget(orchestrator, context)
    const ancestorResult = orchestrator.merge(
      {},
      context.ancestor,
      {},
      undefined
    )

    const targetProp = { [attribute]: targetResult.output }
    const ancestorProp = { [attribute]: ancestorResult.output }

    return withConflict(this.buildConflict(context, targetProp, ancestorProp))
  }

  protected abstract mergeTarget(
    orchestrator: MergeOrchestrator,
    context: MergeContext
  ): MergeResult
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
    return buildEarlyResult(context.other, context.rootKey?.name)
  }
}

class LocalOnlyStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    return buildEarlyResult(context.local, context.rootKey?.name)
  }
}

class LocalAndOtherStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    const local = context.local as JsonObject | JsonArray
    const other = context.other as JsonObject | JsonArray

    if (jsonEqual(local, other)) {
      return buildEarlyResult(local, context.rootKey?.name)
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

  protected getExistsInSecondary(rootKey: RootKeyInfo): boolean {
    return rootKey.existsInOther
  }

  protected buildConflict(
    _context: MergeContext,
    targetObj: JsonObject,
    ancestorObj: JsonObject
  ): JsonArray {
    return [buildConflictMarkers(targetObj, ancestorObj, {})]
  }

  protected mergeTarget(
    orchestrator: MergeOrchestrator,
    context: MergeContext
  ): MergeResult {
    return orchestrator.merge({}, context.local, {}, undefined)
  }
}

class AncestorAndOtherStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): unknown {
    return context.other
  }

  protected getExistsInSecondary(rootKey: RootKeyInfo): boolean {
    return rootKey.existsInLocal
  }

  protected buildConflict(
    _context: MergeContext,
    targetObj: JsonObject | JsonArray,
    ancestorObj: JsonObject | JsonArray
  ): JsonArray {
    return [buildConflictMarkers({}, ancestorObj, targetObj)]
  }

  protected mergeTarget(
    orchestrator: MergeOrchestrator,
    context: MergeContext
  ): MergeResult {
    return orchestrator.merge({}, {}, context.other, undefined)
  }
}

class AllPresentStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    if (
      jsonEqual(context.ancestor, context.local) &&
      jsonEqual(context.local, context.other)
    ) {
      return buildEarlyResult(context.local, context.rootKey?.name)
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

const strategies: Record<MergeScenario, ScenarioStrategy> = {
  [MergeScenario.ALL]: new AllPresentStrategy(),
  [MergeScenario.ANCESTOR_AND_LOCAL]: new AncestorAndLocalStrategy(),
  [MergeScenario.ANCESTOR_AND_OTHER]: new AncestorAndOtherStrategy(),
  [MergeScenario.ANCESTOR_ONLY]: new AncestorOnlyStrategy(),
  [MergeScenario.LOCAL_AND_OTHER]: new LocalAndOtherStrategy(),
  [MergeScenario.LOCAL_ONLY]: new LocalOnlyStrategy(),
  [MergeScenario.NONE]: new NoneStrategy(),
  [MergeScenario.OTHER_ONLY]: new OtherOnlyStrategy(),
}

export const getScenarioStrategy = (
  scenario: MergeScenario
): ScenarioStrategy => strategies[scenario]
