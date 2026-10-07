import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'

export type KeyExtractor = (item: JsonObject) => string | undefined
export type EntryKey = (item: JsonObject) => string

// A lone entry without a key keeps the key it has always had, so it
// merges and sorts as before.
const LONE_KEYLESS_ENTRY_KEY = String(undefined)

export const toEntryKey =
  (keyOf: KeyExtractor): EntryKey =>
  item =>
    keyOf(item) ?? LONE_KEYLESS_ENTRY_KEY

// Two entries with no key on one side would land on one map slot and one
// would silently disappear; a single one is still matched by key.
const KEYLESS_COLLISION = 2

const hasCollidingKeyless = (side: JsonArray, keyOf: KeyExtractor): boolean => {
  let keyless = 0
  for (const item of side) {
    if (keyOf(item as JsonObject) !== undefined) continue
    keyless++
    if (keyless === KEYLESS_COLLISION) return true
  }
  return false
}

export const hasKeylessCollision = (
  sides: readonly JsonArray[],
  keyOf: KeyExtractor
): boolean => sides.some(side => hasCollidingKeyless(side, keyOf))

export const buildKeyedMap = (
  arr: JsonArray,
  keyField: EntryKey
): Map<string, JsonObject> => {
  const map = new Map<string, JsonObject>()
  for (const item of arr) {
    const key = keyField(item as JsonObject)
    map.set(key, item as JsonObject)
  }
  return map
}

/**
 * Fused pass: builds a keyed Map of each array AND collects the union of
 * keys in a single traversal per array. Replaces three `buildKeyedMap`
 * calls plus a separate `collectAllKeys` loop, halving the `keyField`
 * extractor invocations on the merge hot path.
 */
export const indexKeyedArrays = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keyField: EntryKey
): {
  keyedAncestor: Map<string, JsonObject>
  keyedLocal: Map<string, JsonObject>
  keyedOther: Map<string, JsonObject>
  allKeys: Set<string>
} => {
  const allKeys = new Set<string>()
  const keyedAncestor = new Map<string, JsonObject>()
  const keyedLocal = new Map<string, JsonObject>()
  const keyedOther = new Map<string, JsonObject>()

  const fill = (arr: JsonArray, target: Map<string, JsonObject>): void => {
    for (const item of arr) {
      const obj = item as JsonObject
      const key = keyField(obj)
      target.set(key, obj)
      allKeys.add(key)
    }
  }

  fill(ancestor, keyedAncestor)
  fill(local, keyedLocal)
  fill(other, keyedOther)

  return { keyedAncestor, keyedLocal, keyedOther, allKeys }
}
