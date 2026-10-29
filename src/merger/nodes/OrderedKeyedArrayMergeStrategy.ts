import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import {
  combineResults,
  noConflict,
  withConflict,
} from '../../types/mergeResult.js'
import { hasSameOrder, lcs, pushAll } from '../../utils/arrayUtils.js'
import { jsonEqual } from '../../utils/jsonEqual.js'
import { setsEqual, setsIntersect } from '../../utils/setUtils.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { mergeKeyOrder } from '../mergePropertyOrder.js'
import type { KeyedSides } from './KeyedArrayIndex.js'
import { buildKeyedMap } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'

// ============================================================================
// Ordered Strategy
// ============================================================================

interface ArrayMergeState {
  readonly ancestorKeys: readonly string[]
  readonly localKeys: readonly string[]
  readonly otherKeys: readonly string[]
  readonly ancestorMap: ReadonlyMap<string, JsonObject>
  readonly localMap: ReadonlyMap<string, JsonObject>
  readonly otherMap: ReadonlyMap<string, JsonObject>
  // Position maps for O(1) lookups - computed once, reused everywhere
  readonly ancestorPos: ReadonlyMap<string, number>
  readonly localPos: ReadonlyMap<string, number>
  readonly otherPos: ReadonlyMap<string, number>
  readonly ancestorSet: ReadonlySet<string>
}

interface GapKeys {
  readonly ancestor: string[]
  readonly local: string[]
  readonly other: string[]
}

interface GapSets {
  readonly localDeleted: ReadonlySet<string>
  readonly otherDeleted: ReadonlySet<string>
  readonly localAdded: ReadonlySet<string>
  readonly otherAdded: ReadonlySet<string>
  readonly allKeys: readonly string[]
  readonly settled: ReadonlySet<string>
  readonly localSlice: ReadonlySet<string>
  readonly otherSlice: ReadonlySet<string>
}

const isOnAllSides = (ctx: ArrayMergeState, key: string): boolean =>
  ctx.ancestorMap.has(key) && ctx.localMap.has(key) && ctx.otherMap.has(key)

const absentFrom = (
  keys: string[],
  side: ReadonlyMap<string, JsonObject>
): Set<string> => new Set(keys.filter(k => !side.has(k)))

// Deletions and additions are judged against the whole side, never the gap
// slice: leaving or entering a slice is a move, which the merged order
// already settles. A key present on all three sides is merged once, in the
// gap whose local slice holds it; spine anchors are excluded because a
// duplicated key can reappear in a gap.
// Live keys are ordered by the side-symmetric property-order rule; keys only
// the ancestor still holds follow in ancestor order.
const orderGapKeys = (gaps: GapKeys): string[] => {
  const live = mergeKeyOrder([], gaps.local, gaps.other)
  const liveSet = new Set(live)
  return [...live, ...gaps.ancestor.filter(k => !liveSet.has(k))]
}

const computeGapSets = (
  gaps: GapKeys,
  isSettled: (key: string) => boolean,
  ctx: ArrayMergeState
): GapSets => {
  const allKeys = orderGapKeys(gaps)

  return {
    localDeleted: absentFrom(gaps.ancestor, ctx.localMap),
    otherDeleted: absentFrom(gaps.ancestor, ctx.otherMap),
    localAdded: absentFrom(gaps.local, ctx.ancestorMap),
    otherAdded: absentFrom(gaps.other, ctx.ancestorMap),
    allKeys,
    settled: new Set(allKeys.filter(isSettled)),
    localSlice: new Set(gaps.local),
    otherSlice: new Set(gaps.other),
  }
}

// A key a live side still holds outside this gap is merged in the gap that
// holds it, so it is never emitted twice
const isPlacedInAnotherGap = (
  sets: GapSets,
  key: string,
  ctx: ArrayMergeState
): boolean =>
  !sets.localSlice.has(key) &&
  !sets.otherSlice.has(key) &&
  (ctx.localMap.has(key) || ctx.otherMap.has(key))

// ============================================================================
// Ordering Analysis
// ============================================================================

interface OrderingAnalysis {
  canMerge: boolean
  localMoved: Set<string>
  otherMoved: Set<string>
}

const hasOneSidedAdditions = (
  additions: readonly string[],
  opposite: ReadonlyMap<string, JsonObject>
): boolean => additions.some(k => !opposite.has(k))

export class OrderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keys: KeyedSides
  ) {}

  merge(config: MergeConfig): MergeResult {
    const oneSided = this.takeOneSidedChange()
    if (oneSided) {
      return oneSided
    }

    const ctx = this.buildArrayMergeState()

    const orderingAnalysis = this.analyzeOrderings(ctx)

    if (!orderingAnalysis.canMerge) {
      return this.buildFullArrayConflict()
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
    const {
      ancestor: ancestorKeys,
      local: localKeys,
      other: otherKeys,
    } = this.keys

    return {
      ancestorKeys,
      localKeys,
      otherKeys,
      ancestorMap: buildKeyedMap(this.ancestor, ancestorKeys),
      localMap: buildKeyedMap(this.local, localKeys),
      otherMap: buildKeyedMap(this.other, otherKeys),
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
    modifiedPos: ReadonlyMap<string, number>
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
      return this.buildFullArrayConflict()
    }

    return this.processKeyOrder(config, ctx, mergedKeys)
  }

  /**
   * Computes merged key order by combining disjoint reorderings.
   * Also includes elements added in local or other (not in ancestor).
   * Returns null when each side adds an entry the other lacks (conflict).
   */
  private computeMergedKeyOrder(
    ctx: ArrayMergeState,
    analysis: OrderingAnalysis
  ): string[] | null {
    const localAdditions = ctx.localKeys.filter(k => !ctx.ancestorSet.has(k))
    const otherAdditions = ctx.otherKeys.filter(k => !ctx.ancestorSet.has(k))

    // Shared additions have a symmetric order; one-sided ones on both sides
    // have no defensible relative order.
    if (hasOneSidedAdditions(localAdditions, ctx.otherMap)) {
      if (hasOneSidedAdditions(otherAdditions, ctx.localMap)) {
        return null
      }
    }

    const result = this.placeMovedGroups(ctx, analysis)
    pushAll(result, mergeKeyOrder([], localAdditions, otherAdditions))
    return result
  }

  private placeMovedGroups(
    ctx: ArrayMergeState,
    { localMoved, otherMoved }: OrderingAnalysis
  ): string[] {
    const localGroup = ctx.localKeys.filter(k => localMoved.has(k))
    const otherGroup = ctx.otherKeys.filter(k => otherMoved.has(k))
    const result: string[] = []
    let localInserted = false
    let otherInserted = false

    for (const key of ctx.ancestorKeys) {
      if (localMoved.has(key)) {
        if (!localInserted) pushAll(result, localGroup)
        localInserted = true
      } else if (otherMoved.has(key)) {
        if (!otherInserted) pushAll(result, otherGroup)
        otherInserted = true
      } else {
        result.push(key)
      }
    }
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
      if (result && result.output.length > 0) {
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
    // Element exists in all three - standard merge
    if (isOnAllSides(ctx, key)) {
      return this.mergeElement(config, key, ctx)
    }

    // Handle additions and deletions
    return this.mergeGapElement(config, key, ctx)
  }

  private takeOneSidedChange(): MergeResult | null {
    if (jsonEqual(this.ancestor, this.local)) {
      return noConflict(this.wrapSide(this.other))
    }
    if (jsonEqual(this.ancestor, this.other)) {
      return noConflict(this.wrapSide(this.local))
    }
    return null
  }

  // Raw entries, not a key lookup: a repeated key keeps every entry
  private wrapSide(side: JsonArray): JsonArray {
    return side.map(entry => this.wrapElement(entry as JsonObject))
  }

  private wrapKeys(
    keys: readonly string[],
    map: ReadonlyMap<string, JsonObject>
  ): JsonArray {
    return keys.map(k => ({
      [this.attribute]: map.get(k)!,
    }))
  }

  private buildFullArrayConflict(): MergeResult {
    return withConflict([
      buildConflictMarkers(
        this.wrapSide(this.local),
        this.wrapSide(this.ancestor),
        this.wrapSide(this.other)
      ),
    ])
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

    const anchors = new Set(spine)

    for (const anchor of spine) {
      const aEnd = ctx.ancestorPos.get(anchor)!
      const lEnd = ctx.localPos.get(anchor)!
      const oEnd = ctx.otherPos.get(anchor)!

      const gaps: GapKeys = {
        ancestor: ctx.ancestorKeys.slice(aIdx, aEnd),
        local: ctx.localKeys.slice(lIdx, lEnd),
        other: ctx.otherKeys.slice(oIdx, oEnd),
      }
      results.push(this.mergeGap(config, gaps, anchors, ctx))
      results.push(this.mergeElement(config, anchor, ctx))

      aIdx = aEnd + 1
      lIdx = lEnd + 1
      oIdx = oEnd + 1
    }

    const finalGaps: GapKeys = {
      ancestor: ctx.ancestorKeys.slice(aIdx),
      local: ctx.localKeys.slice(lIdx),
      other: ctx.otherKeys.slice(oIdx),
    }
    results.push(this.mergeGap(config, finalGaps, anchors, ctx))

    return combineResults(results)
  }

  // Gap merging

  private mergeGap(
    config: MergeConfig,
    gaps: GapKeys,
    anchors: ReadonlySet<string>,
    ctx: ArrayMergeState
  ): MergeResult {
    const sets = computeGapSets(
      gaps,
      key => isOnAllSides(ctx, key) && !anchors.has(key),
      ctx
    )

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

    // When both sides added disjoint non-empty sets, equality is impossible,
    // so `!setsIntersect` is sufficient — no need for a redundant `!setsEqual`.
    const hasAdditionConflict =
      localAdded.size > 0 &&
      otherAdded.size > 0 &&
      !setsIntersect(localAdded, otherAdded)

    if (hasDeletionConflict || hasAdditionConflict) {
      return this.buildGapConflict(config, gaps, ctx)
    }

    return null
  }

  private buildGapConflict(
    _config: MergeConfig,
    gaps: GapKeys,
    ctx: ArrayMergeState
  ): MergeResult {
    return withConflict([
      buildConflictMarkers(
        this.wrapKeys(gaps.local, ctx.localMap),
        this.wrapKeys(gaps.ancestor, ctx.ancestorMap),
        this.wrapKeys(gaps.other, ctx.otherMap)
      ),
    ])
  }

  private mergeGapElements(
    config: MergeConfig,
    sets: GapSets,
    ctx: ArrayMergeState
  ): MergeResult {
    const results: MergeResult[] = []
    for (const key of sets.allKeys) {
      const result = this.mergeGapKey(config, sets, key, ctx)
      if (result) {
        results.push(result)
      }
    }
    return combineResults(results)
  }

  private mergeGapKey(
    config: MergeConfig,
    sets: GapSets,
    key: string,
    ctx: ArrayMergeState
  ): MergeResult | null {
    if (sets.settled.has(key)) {
      return sets.localSlice.has(key)
        ? this.mergeElement(config, key, ctx)
        : null
    }
    if (isPlacedInAnotherGap(sets, key, ctx)) {
      return null
    }
    return this.mergeGapElement(config, key, ctx)
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
        return jsonEqual(aVal, oVal)
          ? null
          : this.buildElementConflict(config, null, aVal, oVal)
      }
      // Other deleted - conflict if local modified
      return jsonEqual(aVal, lVal)
        ? null
        : this.buildElementConflict(config, lVal, aVal, null)
    }

    // Both added - accept if identical, conflict otherwise
    if (lVal !== undefined && oVal !== undefined) {
      return jsonEqual(lVal, oVal)
        ? noConflict([this.wrapElement(lVal)])
        : this.buildElementConflict(config, lVal, null, oVal)
    }

    // Only one side added
    return noConflict([this.wrapElement(lVal ?? oVal!)])
  }

  // Element helpers

  private wrapElement(value: JsonObject): JsonObject {
    return { [this.attribute]: value }
  }

  private mergeElement(
    config: MergeConfig,
    key: string,
    ctx: ArrayMergeState
  ): MergeResult {
    const aVal = ctx.ancestorMap.get(key)
    const lVal = ctx.localMap.get(key)
    const oVal = ctx.otherMap.get(key)

    // Other unchanged → take local
    if (jsonEqual(aVal, oVal) && lVal) {
      return noConflict([this.wrapElement(lVal)])
    }

    // Local unchanged → take other
    if (jsonEqual(aVal, lVal) && oVal) {
      return noConflict([this.wrapElement(oVal)])
    }

    // Both changed to same
    if (jsonEqual(lVal, oVal)) {
      return noConflict([this.wrapElement(lVal!)])
    }

    return this.buildElementConflict(config, lVal, aVal, oVal)
  }

  private buildElementConflict(
    _config: MergeConfig,
    lVal: JsonObject | null | undefined,
    aVal: JsonObject | null | undefined,
    oVal: JsonObject | null | undefined
  ): MergeResult {
    const wrap = (val: JsonObject | null | undefined) =>
      val ? this.wrapElement(val) : ({} as JsonObject)

    return withConflict([
      buildConflictMarkers(wrap(lVal), wrap(aVal), wrap(oVal)),
    ])
  }
}
