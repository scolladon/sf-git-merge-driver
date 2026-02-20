import { deepEqual } from 'fast-equals'
import { isEmpty } from 'lodash-es'
import { TEXT_TAG } from '../../constant/parserConstant.js'
import { MetadataService } from '../../service/MetadataService.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { pushAll } from '../../utils/arrayUtils.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { toJsonArray } from './nodeUtils.js'

type KeyExtractor = (item: JsonObject) => string

// ============================================================================
// Strategy Interface
// ============================================================================

interface KeyedArrayMergeStrategy {
  merge(config: MergeConfig): MergeResult
}

// ============================================================================
// Shared Helpers
// ============================================================================

const filterEmptyTextNodes = (markers: JsonArray): JsonArray =>
  markers.filter(item => {
    if (item && typeof item === 'object' && TEXT_TAG in item) {
      const text = (item as JsonObject)[TEXT_TAG]
      return !(typeof text === 'string' && text.trim() === '')
    }
    return true
  }) as JsonArray

const buildKeyedMap = (
  arr: JsonArray,
  keyField: KeyExtractor
): Map<string, JsonObject> => {
  const map = new Map<string, JsonObject>()
  for (const item of arr) {
    const key = keyField(item as JsonObject)
    map.set(key, item as JsonObject)
  }
  return map
}

// ============================================================================
// Unkeyed Conflict Strategy
// ============================================================================

class UnkeyedConflictStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const unwrap = (arr: JsonArray) =>
      (arr.length === 1 ? arr[0] : arr) as JsonObject | JsonArray

    return withConflict(
      buildConflictMarkers(
        config,
        unwrap(toJsonArray({ [this.attribute]: this.local })),
        unwrap(toJsonArray({ [this.attribute]: this.ancestor })),
        unwrap(toJsonArray({ [this.attribute]: this.other }))
      )
    )
  }
}

// ============================================================================
// Unordered Strategy
// ============================================================================

class UnorderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor
  ) {}

  merge(config: MergeConfig): MergeResult {
    const allKeys = this.collectAllKeys()
    const keyedAncestor = buildKeyedMap(this.ancestor, this.keyField)
    const keyedLocal = buildKeyedMap(this.local, this.keyField)
    const keyedOther = buildKeyedMap(this.other, this.keyField)

    const results: MergeResult[] = []
    const orchestrator = new MergeOrchestrator(config, defaultNodeFactory)

    for (const key of Array.from(allKeys).sort()) {
      const result = orchestrator.merge(
        keyedAncestor.get(key) ?? {},
        keyedLocal.get(key) ?? {},
        keyedOther.get(key) ?? {},
        this.attribute
      )

      if (!isEmpty(result.output)) {
        results.push({
          output: [{ [this.attribute]: result.output }],
          hasConflict: result.hasConflict,
        })
      }
    }

    return combineResults(results)
  }

  private collectAllKeys(): Set<string> {
    const allKeys = new Set<string>()
    for (const arr of [this.ancestor, this.local, this.other]) {
      for (const item of arr) {
        allKeys.add(this.keyField(item as JsonObject))
      }
    }
    return allKeys
  }
}

// ============================================================================
// Ordered Strategy
// ============================================================================

interface MergeContext {
  ancestorKeys: string[]
  localKeys: string[]
  otherKeys: string[]
  ancestorMap: Map<string, JsonObject>
  localMap: Map<string, JsonObject>
  otherMap: Map<string, JsonObject>
  // Position maps for O(1) lookups - computed once, reused everywhere
  ancestorPos: Map<string, number>
  localPos: Map<string, number>
  otherPos: Map<string, number>
  ancestorSet: Set<string>
}

interface GapSets {
  localDeleted: Set<string>
  otherDeleted: Set<string>
  localAdded: Set<string>
  otherAdded: Set<string>
  allKeys: Set<string>
}

// Ordered strategy helpers

const hasSameOrder = (a: string[], b: string[]): boolean => {
  const bSet = new Set(b)
  const aFiltered = a.filter(k => bSet.has(k))
  const aSet = new Set(a)
  const bFiltered = b.filter(k => aSet.has(k))
  return deepEqual(aFiltered, bFiltered)
}

const lcs = (a: string[], b: string[]): string[] => {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const result: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return result
}

const computeGapSets = (
  gapA: string[],
  gapL: string[],
  gapO: string[]
): GapSets => {
  const ancestorSet = new Set(gapA)
  const localSet = new Set(gapL)
  const otherSet = new Set(gapO)

  return {
    localDeleted: new Set(gapA.filter(k => !localSet.has(k))),
    otherDeleted: new Set(gapA.filter(k => !otherSet.has(k))),
    localAdded: new Set(gapL.filter(k => !ancestorSet.has(k))),
    otherAdded: new Set(gapO.filter(k => !ancestorSet.has(k))),
    allKeys: new Set([...gapA, ...gapL, ...gapO]),
  }
}

const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

const setsIntersect = (a: Set<string>, b: Set<string>): boolean => {
  for (const item of a) {
    if (b.has(item)) return true
  }
  return false
}

// ============================================================================
// Ordering Analysis
// ============================================================================

interface OrderingAnalysis {
  canMerge: boolean
  localMoved: Set<string>
  otherMoved: Set<string>
}

class OrderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor
  ) {}

  merge(config: MergeConfig): MergeResult {
    const ctx = this.buildMergeContext()
    const orderingAnalysis = this.analyzeOrderings(ctx)

    if (!orderingAnalysis.canMerge) {
      return this.buildFullArrayConflict(config, ctx)
    }

    const hasDivergedOrderings =
      orderingAnalysis.localMoved.size > 0 ||
      orderingAnalysis.otherMoved.size > 0

    if (hasDivergedOrderings) {
      return this.processDivergedOrderings(config, ctx, orderingAnalysis)
    }

    return this.processWithSpine(config, ctx)
  }

  // ============================================================================
  // Context Building
  // ============================================================================

  private buildMergeContext(): MergeContext {
    const ancestorKeys = this.ancestor.map(item =>
      this.keyField(item as JsonObject)
    )
    const localKeys = this.local.map(item => this.keyField(item as JsonObject))
    const otherKeys = this.other.map(item => this.keyField(item as JsonObject))

    return {
      ancestorKeys,
      localKeys,
      otherKeys,
      ancestorMap: buildKeyedMap(this.ancestor, this.keyField),
      localMap: buildKeyedMap(this.local, this.keyField),
      otherMap: buildKeyedMap(this.other, this.keyField),
      // Position maps computed once for O(1) lookups
      ancestorPos: new Map(ancestorKeys.map((k, i) => [k, i])),
      localPos: new Map(localKeys.map((k, i) => [k, i])),
      otherPos: new Map(otherKeys.map((k, i) => [k, i])),
      ancestorSet: new Set(ancestorKeys),
    }
  }

  // ============================================================================
  // Ordering Analysis
  // ============================================================================

  private analyzeOrderings(ctx: MergeContext): OrderingAnalysis {
    // Fast path: identical orderings
    if (hasSameOrder(ctx.localKeys, ctx.otherKeys)) {
      return {
        canMerge: true,
        localMoved: new Set(),
        otherMoved: new Set(),
      }
    }

    // Detect which elements moved in each version (relative to ancestor)
    const localMoved = this.getMovedElements(ctx, ctx.localPos)
    const otherMoved = this.getMovedElements(ctx, ctx.otherPos)

    // Overlapping moves = conflict (C4 scenario)
    if (setsIntersect(localMoved, otherMoved)) {
      return { canMerge: false, localMoved, otherMoved }
    }

    // If orderings differ but no ancestor elements moved, the difference
    // must come from added elements at different positions (C6 scenario)
    if (localMoved.size === 0 && otherMoved.size === 0) {
      return { canMerge: false, localMoved, otherMoved }
    }

    return { canMerge: true, localMoved, otherMoved }
  }

  /**
   * Finds elements that changed relative order between ancestor and modified arrays.
   * Uses upper triangle optimization to avoid redundant pair comparisons.
   * Complexity: O(n²) for n elements - acceptable for typical metadata array sizes.
   */
  private getMovedElements(
    ctx: MergeContext,
    modifiedPos: Map<string, number>
  ): Set<string> {
    const moved = new Set<string>()

    // Only check upper triangle (i < j) to avoid duplicate comparisons
    for (let i = 0; i < ctx.ancestorKeys.length; i++) {
      const a = ctx.ancestorKeys[i]
      const aMod = modifiedPos.get(a)
      if (aMod === undefined) continue

      for (let j = i + 1; j < ctx.ancestorKeys.length; j++) {
        const b = ctx.ancestorKeys[j]
        const bMod = modifiedPos.get(b)
        if (bMod === undefined) continue

        // In ancestor: a comes before b (i < j)
        // Check if order reversed in modified
        if (aMod > bMod) {
          moved.add(a)
          moved.add(b)
        }
      }
    }

    return moved
  }

  // ============================================================================
  // Diverged Orderings Processing
  // ============================================================================

  private processDivergedOrderings(
    config: MergeConfig,
    ctx: MergeContext,
    analysis: OrderingAnalysis
  ): MergeResult {
    const mergedKeys = this.computeMergedKeyOrder(ctx, analysis)

    if (mergedKeys === null) {
      return this.buildFullArrayConflict(config, ctx)
    }

    return this.processKeyOrder(config, ctx, mergedKeys)
  }

  /**
   * Computes merged key order by combining disjoint reorderings.
   * Also includes elements added in local or other (not in ancestor).
   * Returns null if concurrent disjoint additions are detected (conflict).
   */
  private computeMergedKeyOrder(
    ctx: MergeContext,
    analysis: OrderingAnalysis
  ): string[] | null {
    const { localMoved, otherMoved } = analysis

    // Build ordered lists for moved elements in a single pass each
    const localMovedOrdered: string[] = []
    const otherMovedOrdered: string[] = []
    const localAdditions: string[] = []
    const otherAdditions: string[] = []

    for (const key of ctx.localKeys) {
      if (localMoved.has(key)) {
        localMovedOrdered.push(key)
      } else if (!ctx.ancestorSet.has(key)) {
        localAdditions.push(key)
      }
    }

    for (const key of ctx.otherKeys) {
      if (otherMoved.has(key)) {
        otherMovedOrdered.push(key)
      } else if (!ctx.ancestorSet.has(key) && !ctx.localMap.has(key)) {
        // Only add if not already added by local
        otherAdditions.push(key)
      }
    }

    // Conflict: both sides added different elements - ambiguous ordering
    if (localAdditions.length > 0 && otherAdditions.length > 0) {
      return null
    }

    // Build result by traversing ancestor and inserting moved groups
    const result: string[] = []
    let localMovedInserted = false
    let otherMovedInserted = false

    for (const key of ctx.ancestorKeys) {
      if (localMoved.has(key)) {
        if (!localMovedInserted) {
          pushAll(result, localMovedOrdered)
          localMovedInserted = true
        }
      } else if (otherMoved.has(key)) {
        if (!otherMovedInserted) {
          pushAll(result, otherMovedOrdered)
          otherMovedInserted = true
        }
      } else {
        result.push(key)
      }
    }

    // Append additions at the end (preserving their relative order)
    pushAll(result, localAdditions, otherAdditions)
    return result
  }

  // ============================================================================
  // Spine-based Processing
  // ============================================================================

  private processWithSpine(
    config: MergeConfig,
    ctx: MergeContext
  ): MergeResult {
    const spine = lcs(
      lcs(ctx.ancestorKeys, ctx.localKeys),
      lcs(ctx.ancestorKeys, ctx.otherKeys)
    )

    return this.processSpine(config, spine, ctx)
  }

  // ============================================================================
  // Common Processing
  // ============================================================================

  /**
   * Processes elements in the given key order, merging each element.
   * Handles elements present in any of the three versions.
   */
  private processKeyOrder(
    config: MergeConfig,
    ctx: MergeContext,
    keys: string[]
  ): MergeResult {
    const results: MergeResult[] = []

    for (const key of keys) {
      const result = this.mergeElementWithPresenceCheck(config, key, ctx)
      if (result && !isEmpty(result.output)) {
        results.push(result)
      }
    }

    return combineResults(results)
  }

  /**
   * Merges an element considering it might not exist in all three versions.
   * Handles additions and deletions alongside modifications.
   */
  private mergeElementWithPresenceCheck(
    config: MergeConfig,
    key: string,
    ctx: MergeContext
  ): MergeResult | null {
    const inA = ctx.ancestorMap.has(key)
    const inL = ctx.localMap.has(key)
    const inO = ctx.otherMap.has(key)

    // Element exists in all three - standard merge
    if (inA && inL && inO) {
      return this.mergeElement(config, key, ctx)
    }

    // Handle additions and deletions
    return this.mergeGapElement(config, key, ctx)
  }

  private wrapKeys(keys: string[], map: Map<string, JsonObject>): JsonArray {
    return keys.map(k => ({
      [this.attribute]: toJsonArray(map.get(k)!),
    }))
  }

  private buildFullArrayConflict(
    config: MergeConfig,
    ctx: MergeContext
  ): MergeResult {
    return withConflict(
      buildConflictMarkers(
        config,
        this.wrapKeys(ctx.localKeys, ctx.localMap),
        this.wrapKeys(ctx.ancestorKeys, ctx.ancestorMap),
        this.wrapKeys(ctx.otherKeys, ctx.otherMap)
      )
    )
  }

  // Spine processing

  private processSpine(
    config: MergeConfig,
    spine: string[],
    ctx: MergeContext
  ): MergeResult {
    const results: MergeResult[] = []
    let aIdx = 0
    let lIdx = 0
    let oIdx = 0

    for (const anchor of spine) {
      const gapA = this.collectUntil(ctx.ancestorKeys, aIdx, anchor)
      const gapL = this.collectUntil(ctx.localKeys, lIdx, anchor)
      const gapO = this.collectUntil(ctx.otherKeys, oIdx, anchor)

      aIdx += gapA.length
      lIdx += gapL.length
      oIdx += gapO.length

      const gapResult = this.mergeGap(config, gapA, gapL, gapO, ctx)
      if (gapResult.output.length > 0 || gapResult.hasConflict) {
        results.push(gapResult)
      }

      results.push(this.mergeElement(config, anchor, ctx))

      aIdx++
      lIdx++
      oIdx++
    }

    const finalResult = this.mergeGap(
      config,
      ctx.ancestorKeys.slice(aIdx),
      ctx.localKeys.slice(lIdx),
      ctx.otherKeys.slice(oIdx),
      ctx
    )
    if (finalResult.output.length > 0 || finalResult.hasConflict) {
      results.push(finalResult)
    }

    return combineResults(results)
  }

  private collectUntil(
    keys: string[],
    startIdx: number,
    anchor: string
  ): string[] {
    const result: string[] = []
    for (let i = startIdx; i < keys.length && keys[i] !== anchor; i++) {
      result.push(keys[i])
    }
    return result
  }

  // Gap merging

  private mergeGap(
    config: MergeConfig,
    gapA: string[],
    gapL: string[],
    gapO: string[],
    ctx: MergeContext
  ): MergeResult {
    if (gapA.length === 0 && gapL.length === 0 && gapO.length === 0) {
      return noConflict([])
    }

    const sets = computeGapSets(gapA, gapL, gapO)

    const gapConflict = this.detectGapConflict(
      config,
      gapL,
      gapA,
      gapO,
      sets,
      ctx
    )
    if (gapConflict) {
      return gapConflict
    }

    return this.mergeGapElements(config, sets, ctx)
  }

  private detectGapConflict(
    config: MergeConfig,
    gapL: string[],
    gapA: string[],
    gapO: string[],
    sets: GapSets,
    ctx: MergeContext
  ): MergeResult | null {
    const { localDeleted, otherDeleted, localAdded, otherAdded } = sets

    const hasDeletionConflict =
      localDeleted.size > 0 &&
      otherDeleted.size > 0 &&
      !setsEqual(localDeleted, otherDeleted)

    const hasAdditionConflict =
      localAdded.size > 0 &&
      otherAdded.size > 0 &&
      !setsIntersect(localAdded, otherAdded) &&
      !setsEqual(localAdded, otherAdded)

    if (hasDeletionConflict || hasAdditionConflict) {
      return this.buildGapConflict(config, gapL, gapA, gapO, ctx)
    }

    return null
  }

  private buildGapConflict(
    config: MergeConfig,
    gapL: string[],
    gapA: string[],
    gapO: string[],
    ctx: MergeContext
  ): MergeResult {
    return withConflict(
      filterEmptyTextNodes(
        buildConflictMarkers(
          config,
          this.wrapKeys(gapL, ctx.localMap),
          this.wrapKeys(gapA, ctx.ancestorMap),
          this.wrapKeys(gapO, ctx.otherMap)
        )
      )
    )
  }

  private mergeGapElements(
    config: MergeConfig,
    sets: GapSets,
    ctx: MergeContext
  ): MergeResult {
    const results: MergeResult[] = []
    for (const key of sets.allKeys) {
      const result = this.mergeGapElement(config, key, ctx)
      if (result) {
        results.push(result)
      }
    }
    return combineResults(results)
  }

  /**
   * Merges a single element based on its presence pattern across versions.
   * Uses ElementPresence enum for readable pattern matching.
   */
  private mergeGapElement(
    config: MergeConfig,
    key: string,
    ctx: MergeContext
  ): MergeResult | null {
    const aVal = ctx.ancestorMap.get(key)
    const lVal = ctx.localMap.get(key)
    const oVal = ctx.otherMap.get(key)

    if (aVal !== undefined) {
      if (lVal === undefined) {
        // Both deleted - nothing to output
        if (oVal === undefined) {
          return null
        }
        // Local deleted - conflict if other modified
        return deepEqual(aVal, oVal)
          ? null
          : this.buildElementConflict(config, null, aVal, oVal)
      }
      // Other deleted - conflict if local modified
      return deepEqual(aVal, lVal)
        ? null
        : this.buildElementConflict(config, lVal, aVal, null)
    }

    // Both added - accept if identical, conflict otherwise
    if (lVal !== undefined && oVal !== undefined) {
      return deepEqual(lVal, oVal)
        ? noConflict([this.wrapElement(lVal)])
        : this.buildElementConflict(config, lVal, null, oVal)
    }

    // Only one side added
    return noConflict([this.wrapElement(lVal ?? oVal!)])
  }

  // Element helpers

  private wrapElement(value: JsonObject): JsonObject {
    return { [this.attribute]: toJsonArray(value) }
  }

  private mergeElement(
    config: MergeConfig,
    key: string,
    ctx: MergeContext
  ): MergeResult {
    const aVal = ctx.ancestorMap.get(key)
    const lVal = ctx.localMap.get(key)
    const oVal = ctx.otherMap.get(key)

    // All equal
    if (deepEqual(aVal, lVal) && deepEqual(lVal, oVal)) {
      return noConflict([this.wrapElement(lVal!)])
    }

    // Other unchanged → take local
    if (deepEqual(aVal, oVal) && lVal) {
      return noConflict([this.wrapElement(lVal)])
    }

    // Local unchanged → take other
    if (deepEqual(aVal, lVal) && oVal) {
      return noConflict([this.wrapElement(oVal)])
    }

    // Both changed to same
    if (deepEqual(lVal, oVal)) {
      return noConflict([this.wrapElement(lVal!)])
    }

    return this.buildElementConflict(config, lVal, aVal, oVal)
  }

  private buildElementConflict(
    config: MergeConfig,
    lVal: JsonObject | null | undefined,
    aVal: JsonObject | null | undefined,
    oVal: JsonObject | null | undefined
  ): MergeResult {
    const wrap = (val: JsonObject | null | undefined) =>
      val ? this.wrapElement(val) : ({} as JsonObject)

    return withConflict(
      filterEmptyTextNodes(
        buildConflictMarkers(config, wrap(lVal), wrap(aVal), wrap(oVal))
      )
    )
  }
}

// ============================================================================
// KeyedArrayMergeNode
// ============================================================================

export class KeyedArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const keyField = MetadataService.getKeyFieldExtractor(this.attribute)

    if (!keyField) {
      return new UnkeyedConflictStrategy(
        this.ancestor,
        this.local,
        this.other,
        this.attribute
      ).merge(config)
    }

    const args = [
      this.ancestor,
      this.local,
      this.other,
      this.attribute,
      keyField,
    ] as const

    const strategy = MetadataService.isOrderedAttribute(this.attribute)
      ? new OrderedKeyedArrayMergeStrategy(...args)
      : new UnorderedKeyedArrayMergeStrategy(...args)

    return strategy.merge(config)
  }
}
