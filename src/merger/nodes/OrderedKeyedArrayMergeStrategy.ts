import { deepEqual } from 'fast-equals'
import { isEmpty } from 'lodash-es'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  isNonEmpty,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { hasSameOrder, lcs, pushAll } from '../../utils/arrayUtils.js'
import { setsEqual, setsIntersect } from '../../utils/setUtils.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { KeyExtractor } from './nodeUtils.js'
import {
  buildKeyedMap,
  filterEmptyTextNodes,
  toJsonArray,
} from './nodeUtils.js'

// ============================================================================
// Strategy Interface
// ============================================================================

export interface KeyedArrayMergeStrategy {
  merge(config: MergeConfig): MergeResult
}

// ============================================================================
// Ordered Strategy
// ============================================================================

interface ArrayMergeState {
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

interface GapKeys {
  readonly ancestor: string[]
  readonly local: string[]
  readonly other: string[]
}

interface GapSets {
  localDeleted: Set<string>
  otherDeleted: Set<string>
  localAdded: Set<string>
  otherAdded: Set<string>
  allKeys: Set<string>
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

// ============================================================================
// Ordering Analysis
// ============================================================================

interface OrderingAnalysis {
  canMerge: boolean
  localMoved: Set<string>
  otherMoved: Set<string>
}

export class OrderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor
  ) {}

  merge(config: MergeConfig): MergeResult {
    const ctx = this.buildArrayMergeState()
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

  private buildArrayMergeState(): ArrayMergeState {
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

  private analyzeOrderings(ctx: ArrayMergeState): OrderingAnalysis {
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
    ctx: ArrayMergeState,
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
    ctx: ArrayMergeState,
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
    ctx: ArrayMergeState,
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
    ctx: ArrayMergeState
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
    ctx: ArrayMergeState,
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
    ctx: ArrayMergeState
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
    ctx: ArrayMergeState
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
    ctx: ArrayMergeState
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

      const gaps: GapKeys = { ancestor: gapA, local: gapL, other: gapO }
      const gapResult = this.mergeGap(config, gaps, ctx)
      if (isNonEmpty(gapResult)) {
        results.push(gapResult)
      }

      results.push(this.mergeElement(config, anchor, ctx))

      aIdx++
      lIdx++
      oIdx++
    }

    const finalGaps: GapKeys = {
      ancestor: ctx.ancestorKeys.slice(aIdx),
      local: ctx.localKeys.slice(lIdx),
      other: ctx.otherKeys.slice(oIdx),
    }
    const finalResult = this.mergeGap(config, finalGaps, ctx)
    if (isNonEmpty(finalResult)) {
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
    gaps: GapKeys,
    ctx: ArrayMergeState
  ): MergeResult {
    if (
      gaps.ancestor.length === 0 &&
      gaps.local.length === 0 &&
      gaps.other.length === 0
    ) {
      return noConflict([])
    }

    const sets = computeGapSets(gaps.ancestor, gaps.local, gaps.other)

    const gapConflict = this.detectGapConflict(config, gaps, sets, ctx)
    if (gapConflict) {
      return gapConflict
    }

    return this.mergeGapElements(config, sets, ctx)
  }

  private detectGapConflict(
    config: MergeConfig,
    gaps: GapKeys,
    sets: GapSets,
    ctx: ArrayMergeState
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
      return this.buildGapConflict(config, gaps, ctx)
    }

    return null
  }

  private buildGapConflict(
    config: MergeConfig,
    gaps: GapKeys,
    ctx: ArrayMergeState
  ): MergeResult {
    return withConflict(
      filterEmptyTextNodes(
        buildConflictMarkers(
          config,
          this.wrapKeys(gaps.local, ctx.localMap),
          this.wrapKeys(gaps.ancestor, ctx.ancestorMap),
          this.wrapKeys(gaps.other, ctx.otherMap)
        )
      )
    )
  }

  private mergeGapElements(
    config: MergeConfig,
    sets: GapSets,
    ctx: ArrayMergeState
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
    ctx: ArrayMergeState
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
    ctx: ArrayMergeState
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
