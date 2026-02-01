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
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { MergeOrchestrator } from '../MergeOrchestrator.js'
import type { MergeNode } from './MergeNode.js'
import { defaultNodeFactory } from './MergeNodeFactory.js'
import { toJsonArray } from './nodeUtils.js'

type KeyExtractor = (item: JsonObject) => string

/**
 * Context holding the three-way merge state for ordered arrays.
 */
interface MergeContext {
  ancestorKeys: string[]
  localKeys: string[]
  otherKeys: string[]
  ancestorMap: Map<string, JsonObject>
  localMap: Map<string, JsonObject>
  otherMap: Map<string, JsonObject>
}

/**
 * Set operations result for a gap
 */
interface GapSets {
  localDeleted: Set<string>
  otherDeleted: Set<string>
  localAdded: Set<string>
  otherAdded: Set<string>
  allKeys: Set<string>
}

// ============================================================================
// Pure utility functions
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
      return this.buildUnkeyedConflict(config)
    }

    return MetadataService.isOrderedAttribute(this.attribute)
      ? this.mergeOrdered(config, keyField)
      : this.mergeUnordered(config, keyField)
  }

  // ==========================================================================
  // Entry points
  // ==========================================================================

  private buildUnkeyedConflict(config: MergeConfig): MergeResult {
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

  private mergeUnordered(
    config: MergeConfig,
    keyField: KeyExtractor
  ): MergeResult {
    const allKeys = new Set<string>()
    for (const arr of [this.ancestor, this.local, this.other]) {
      for (const item of arr) {
        allKeys.add(keyField(item as JsonObject))
      }
    }

    const keyedAncestor = buildKeyedMap(this.ancestor, keyField)
    const keyedLocal = buildKeyedMap(this.local, keyField)
    const keyedOther = buildKeyedMap(this.other, keyField)

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

  // ==========================================================================
  // Ordered merge algorithm
  // ==========================================================================

  private mergeOrdered(
    config: MergeConfig,
    keyField: KeyExtractor
  ): MergeResult {
    const ctx = this.buildMergeContext(keyField)

    if (!hasSameOrder(ctx.localKeys, ctx.otherKeys)) {
      return this.buildFullArrayConflict(config, ctx)
    }

    const spine = lcs(
      lcs(ctx.ancestorKeys, ctx.localKeys),
      lcs(ctx.ancestorKeys, ctx.otherKeys)
    )

    return this.processSpine(config, spine, ctx)
  }

  private buildMergeContext(keyField: KeyExtractor): MergeContext {
    return {
      ancestorKeys: this.ancestor.map(item => keyField(item as JsonObject)),
      localKeys: this.local.map(item => keyField(item as JsonObject)),
      otherKeys: this.other.map(item => keyField(item as JsonObject)),
      ancestorMap: buildKeyedMap(this.ancestor, keyField),
      localMap: buildKeyedMap(this.local, keyField),
      otherMap: buildKeyedMap(this.other, keyField),
    }
  }

  private buildFullArrayConflict(
    config: MergeConfig,
    ctx: MergeContext
  ): MergeResult {
    const wrapKeys = (keys: string[], map: Map<string, JsonObject>) =>
      keys.map(k => ({ [this.attribute]: map.get(k) }))

    return withConflict(
      buildConflictMarkers(
        config,
        wrapKeys(ctx.localKeys, ctx.localMap) as JsonArray,
        wrapKeys(ctx.ancestorKeys, ctx.ancestorMap) as JsonArray,
        wrapKeys(ctx.otherKeys, ctx.otherMap) as JsonArray
      )
    )
  }

  // ==========================================================================
  // Spine processing
  // ==========================================================================

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

      const anchorResult = this.mergeElement(config, anchor, ctx)
      if (!isEmpty(anchorResult.output)) {
        results.push(anchorResult)
      }

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

  // ==========================================================================
  // Gap merging
  // ==========================================================================

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
    const wrapKeys = (keys: string[], map: Map<string, JsonObject>) =>
      keys.map(k => ({ [this.attribute]: map.get(k) }))

    return withConflict(
      filterEmptyTextNodes(
        buildConflictMarkers(
          config,
          wrapKeys(gapL, ctx.localMap) as JsonArray,
          wrapKeys(gapA, ctx.ancestorMap) as JsonArray,
          wrapKeys(gapO, ctx.otherMap) as JsonArray
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

  private mergeGapElement(
    config: MergeConfig,
    key: string,
    ctx: MergeContext
  ): MergeResult | null {
    const inA = ctx.ancestorMap.has(key)
    const inL = ctx.localMap.has(key)
    const inO = ctx.otherMap.has(key)
    const aVal = ctx.ancestorMap.get(key)
    const lVal = ctx.localMap.get(key)
    const oVal = ctx.otherMap.get(key)

    // Both deleted
    if (inA && !inL && !inO) return null

    // In all three
    if (inA && inL && inO) return this.mergeElement(config, key, ctx)

    // Local deleted, other kept
    if (inA && !inL && inO) {
      return deepEqual(aVal, oVal)
        ? null
        : this.buildElementConflict(config, null, aVal, oVal)
    }

    // Other deleted, local kept
    if (inA && inL && !inO) {
      return deepEqual(aVal, lVal)
        ? null
        : this.buildElementConflict(config, lVal, aVal, null)
    }

    // Both added
    if (!inA && inL && inO) {
      return deepEqual(lVal, oVal)
        ? noConflict([this.wrapElement(lVal!)])
        : this.buildElementConflict(config, lVal, null, oVal)
    }

    // Only local added
    if (!inA && inL && !inO) return noConflict([this.wrapElement(lVal!)])

    // Only other added
    // (!inA && !inL && inO) - this is the only remaining case
    return noConflict([this.wrapElement(oVal!)])
  }

  // ==========================================================================
  // Element helpers
  // ==========================================================================

  private wrapElement(value: JsonObject): JsonObject {
    return { [this.attribute]: value }
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
      return lVal ? noConflict([this.wrapElement(lVal)]) : noConflict([])
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
      return lVal ? noConflict([this.wrapElement(lVal)]) : noConflict([])
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
