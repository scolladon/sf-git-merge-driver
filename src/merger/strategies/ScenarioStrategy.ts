import {
  createEmptyBody,
  type JsonArray,
  type JsonObject,
  type JsonValue,
  toJsonObjectOrEmpty,
} from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  buildEarlyResult,
  combineResults,
  expandRepeatedChild,
  noConflict,
  withConflict,
  wrapWithRootKey,
} from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { jsonEqual, jsonIdentical } from '../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeContext, RootKeyInfo } from '../MergeContext.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import { sameContent } from '../sameContent.js'
import { mergePropertyOrder } from '../tagOrder/mergePropertyOrder.js'
import { mergeTagsInOrder } from '../tagOrder/propertyOrderConflict.js'

// ============================================================================
// Strategy Interface
// ============================================================================

interface ElementSides {
  readonly ancestor: JsonObject | undefined
  readonly local: JsonObject
  readonly other: JsonObject
}

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
    ancestor?: JsonValue
  ): MergeResult {
    // Narrow once up front; direct indexing in the loop avoids a per-key
    // Array.isArray on the hot path.
    const sides = {
      ancestor:
        // Stryker disable next-line ConditionalExpression: an absent ancestor and an empty body have no keys, no tag, and the same empty view in a conflict block
        ancestor === undefined ? undefined : toJsonObjectOrEmpty(ancestor),
      local: toJsonObjectOrEmpty(context.local),
      other: toJsonObjectOrEmpty(context.other),
    }
    const results = mergeTagsInOrder(
      mergePropertyOrder(
        sides.ancestor,
        sides.local,
        sides.other,
        context.contestedTagOrder,
        context.tagOrders
      ),
      sides,
      key => this.mergeTag(context, sides, key)
    )

    return this.rooted(context, combineResults(results))
  }

  private mergeTag(
    context: MergeContext,
    sides: ElementSides,
    key: string
  ): MergeResult {
    return context.nodeFactory
      .createNode(
        sides.ancestor?.[key],
        sides.local[key],
        sides.other[key],
        key
      )
      .merge(context.config)
  }

  private rooted(context: MergeContext, result: MergeResult): MergeResult {
    if (context.rootKey) {
      return wrapWithRootKey(result, context.rootKey.name)
    }
    return result
  }
}

// A side that does not exist contests as an empty one
const present = (value: JsonValue | undefined): JsonValue => value ?? null

const isBody = (
  value: JsonValue | undefined
): value is JsonObject | JsonArray =>
  typeof value === 'object' && value !== null

const asBody = (value: JsonValue | undefined): JsonObject | JsonArray =>
  isBody(value) ? value : createEmptyBody()

abstract class AbstractAncestorStrategy implements ScenarioStrategy {
  execute(context: MergeContext): MergeResult {
    const target = this.getTarget(context)
    const targetUnchanged = sameContent(context.ancestor, target)

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
    target: JsonValue | undefined,
    targetUnchanged: boolean
  ): MergeResult {
    const { name } = rootKey
    const existsInSecondary = this.getExistsInSecondary(rootKey)

    if (!existsInSecondary && targetUnchanged) {
      return noConflict([])
    }

    if (!existsInSecondary) {
      const targetObj = { [name]: expandRepeatedChild(present(target)) }
      const ancestorObj = {
        [name]: expandRepeatedChild(present(context.ancestor)),
      }
      return withConflict(this.buildConflict(context, targetObj, ancestorObj))
    }

    return wrapWithRootKey(this.executeNested(context, targetUnchanged), name)
  }

  private executeWithoutRootKey(
    context: MergeContext,
    target: JsonValue | undefined,
    targetUnchanged: boolean
  ): MergeResult {
    if (targetUnchanged) {
      return noConflict([])
    }

    return withConflict(
      this.buildConflict(
        context,
        expandRepeatedChild(present(target)),
        expandRepeatedChild(present(context.ancestor))
      )
    )
  }

  protected abstract getTarget(context: MergeContext): JsonValue | undefined

  protected abstract getExistsInSecondary(rootKey: RootKeyInfo): boolean

  protected abstract buildConflict(
    context: MergeContext,
    targetObj: JsonValue,
    ancestorObj: JsonValue
  ): JsonArray

  private executeNested(
    context: MergeContext,
    targetUnchanged: boolean
  ): MergeResult {
    const target = this.getTarget(context)
    if (!targetUnchanged && isBody(context.ancestor) && isBody(target)) {
      return this.mergeAgainstEmptied(context)
    }
    const orchestrator = new MergeOrchestrator(
      context.config,
      context.nodeFactory
    )
    return orchestrator.merge(context.ancestor, context.local, context.other)
  }

  // The type, not an unrelated sibling, decides how entries merge (ADR 072):
  // a side that empties the root is merged entry by entry, so only the
  // entries the other side changed conflict (ADR 053).
  private mergeAgainstEmptied(context: MergeContext): MergeResult {
    return getScenarioStrategy(MergeScenario.ALL).execute({
      ...context,
      local: asBody(context.local),
      other: asBody(context.other),
      rootKey: undefined,
    })
  }
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
    if (jsonIdentical(context.local, context.other)) {
      return buildEarlyResult(context.local, context.rootKey?.name)
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
  protected getTarget(context: MergeContext): JsonValue | undefined {
    return context.local
  }

  protected getExistsInSecondary(rootKey: RootKeyInfo): boolean {
    return rootKey.existsInOther
  }

  protected buildConflict(
    _context: MergeContext,
    targetObj: JsonValue,
    ancestorObj: JsonValue
  ): JsonArray {
    return [buildConflictMarkers(targetObj, ancestorObj, {})]
  }
}

class AncestorAndOtherStrategy extends AbstractAncestorStrategy {
  protected getTarget(context: MergeContext): JsonValue | undefined {
    return context.other
  }

  protected getExistsInSecondary(rootKey: RootKeyInfo): boolean {
    return rootKey.existsInLocal
  }

  protected buildConflict(
    _context: MergeContext,
    targetObj: JsonValue,
    ancestorObj: JsonValue
  ): JsonArray {
    return [buildConflictMarkers({}, ancestorObj, targetObj)]
  }
}

// Local and other write the same thing, which is the ancestor up to the order
// of its tags: each child merges to that, so the merge is already known. The
// order-blind comparison only runs when the cheap one fails.
const bothSidesMadeTheSameChange = (context: MergeContext): boolean =>
  jsonIdentical(context.local, context.other) &&
  (jsonIdentical(context.ancestor, context.local) ||
    jsonEqual(context.ancestor, context.local))

class AllPresentStrategy extends AbstractMergeStrategy {
  execute(context: MergeContext): MergeResult {
    if (bothSidesMadeTheSameChange(context)) {
      return buildEarlyResult(context.local, context.rootKey?.name)
    }

    return this.mergeChildren(context, context.ancestor)
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
