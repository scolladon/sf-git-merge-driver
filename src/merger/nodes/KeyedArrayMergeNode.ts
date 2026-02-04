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

// Find elements that changed relative order between base and modified arrays
const getMovedElements = (base: string[], modified: string[]): Set<string> => {
  const moved = new Set<string>()
  const basePos = new Map(base.map((k, i) => [k, i]))
  const modPos = new Map(modified.map((k, i) => [k, i]))

  for (const a of base) {
    for (const b of base) {
      if (a === b) continue
      const aBase = basePos.get(a)
      const bBase = basePos.get(b)
      const aMod = modPos.get(a)
      const bMod = modPos.get(b)

      if (
        aBase === undefined ||
        bBase === undefined ||
        aMod === undefined ||
        bMod === undefined
      ) {
        continue
      }

      // If relative order changed, both elements are considered "moved"
      if (aBase < bBase !== aMod < bMod) {
        moved.add(a)
        moved.add(b)
      }
    }
  }
  return moved
}

// Merge disjoint reorderings from local and other
const mergeDisjointOrderings = (
  ancestorKeys: string[],
  localKeys: string[],
  otherKeys: string[],
  localMoved: Set<string>,
  otherMoved: Set<string>
): string[] => {
  // Get the relative ordering for each moved set from the version that moved them
  const localMovedOrdered = localKeys.filter(k => localMoved.has(k))
  const otherMovedOrdered = otherKeys.filter(k => otherMoved.has(k))

  const result: string[] = []
  let localMovedInserted = false
  let otherMovedInserted = false

  for (const key of ancestorKeys) {
    if (localMoved.has(key)) {
      // Insert all localMoved elements at first occurrence
      if (!localMovedInserted) {
        result.push(...localMovedOrdered)
        localMovedInserted = true
      }
    } else if (otherMoved.has(key)) {
      // Insert all otherMoved elements at first occurrence
      if (!otherMovedInserted) {
        result.push(...otherMovedOrdered)
        otherMovedInserted = true
      }
    } else {
      // Unchanged element
      result.push(key)
    }
  }

  return result
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

    if (!hasSameOrder(ctx.localKeys, ctx.otherKeys)) {
      // Check if ordering changes are disjoint (can be merged)
      const localMoved = getMovedElements(ctx.ancestorKeys, ctx.localKeys)
      const otherMoved = getMovedElements(ctx.ancestorKeys, ctx.otherKeys)

      // If moved sets overlap, it's a conflict (C4 scenario)
      if (setsIntersect(localMoved, otherMoved)) {
        return this.buildFullArrayConflict(config, ctx)
      }

      // Disjoint reorderings - compute merged order and process
      const mergedKeys = mergeDisjointOrderings(
        ctx.ancestorKeys,
        ctx.localKeys,
        ctx.otherKeys,
        localMoved,
        otherMoved
      )

      return this.processMergedOrder(config, ctx, mergedKeys)
    }

    const spine = lcs(
      lcs(ctx.ancestorKeys, ctx.localKeys),
      lcs(ctx.ancestorKeys, ctx.otherKeys)
    )

    return this.processSpine(config, spine, ctx)
  }

  private buildMergeContext(): MergeContext {
    return {
      ancestorKeys: this.ancestor.map(item =>
        this.keyField(item as JsonObject)
      ),
      localKeys: this.local.map(item => this.keyField(item as JsonObject)),
      otherKeys: this.other.map(item => this.keyField(item as JsonObject)),
      ancestorMap: buildKeyedMap(this.ancestor, this.keyField),
      localMap: buildKeyedMap(this.local, this.keyField),
      otherMap: buildKeyedMap(this.other, this.keyField),
    }
  }

  private wrapKeys(keys: string[], map: Map<string, JsonObject>): JsonArray {
    return keys.map(k => ({ [this.attribute]: map.get(k)! }))
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

  // Process merged order when disjoint reorderings are detected
  private processMergedOrder(
    config: MergeConfig,
    ctx: MergeContext,
    mergedKeys: string[]
  ): MergeResult {
    const results: MergeResult[] = []

    for (const key of mergedKeys) {
      const result = this.mergeElement(config, key, ctx)
      if (!isEmpty(result.output)) {
        results.push(result)
      }
    }

    return combineResults(results)
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
    return noConflict([this.wrapElement(oVal!)])
  }

  // Element helpers

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
