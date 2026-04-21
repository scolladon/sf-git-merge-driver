import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'

export type KeyExtractor = (item: JsonObject) => string

export const buildKeyedMap = (
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
  keyField: KeyExtractor
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
