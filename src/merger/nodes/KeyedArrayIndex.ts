import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'

export type KeyExtractor = (item: JsonObject) => string | undefined

// Aligned by index with the side's entries; `undefined` marks a keyless one.
export type ExtractedKeys = readonly (string | undefined)[]

// Aligned by index with the side's entries; keyless ones hold the fallback key.
export type SideKeys = readonly string[]

export interface KeyedSides {
  readonly ancestor: SideKeys
  readonly local: SideKeys
  readonly other: SideKeys
}

// A lone entry without a key keeps the key it has always had, so it
// merges and sorts as before.
const LONE_KEYLESS_ENTRY_KEY = String(undefined)

export const extractKeys = (
  side: JsonArray,
  keyOf: KeyExtractor
): ExtractedKeys => side.map(item => keyOf(item as JsonObject))

export const toEntryKeys = (keys: ExtractedKeys): SideKeys =>
  keys.map(key => key ?? LONE_KEYLESS_ENTRY_KEY)

// A keyless entry takes the fallback key, which a real key spelled the same
// way also holds: two such entries on one side would land on one map slot
// and one would silently disappear. A single one is still matched by key.
const KEYLESS_COLLISION = 2

const hasCollidingKeyless = (keys: ExtractedKeys): boolean => {
  let keyless = 0
  let onFallbackKey = 0
  for (const key of keys) {
    if (key === undefined) keyless++
    else if (key !== LONE_KEYLESS_ENTRY_KEY) continue
    onFallbackKey++
    if (keyless > 0 && onFallbackKey >= KEYLESS_COLLISION) return true
  }
  return false
}

export const hasKeylessCollision = (sides: readonly ExtractedKeys[]): boolean =>
  sides.some(hasCollidingKeyless)

export const buildKeyedMap = (
  entries: JsonArray,
  keys: SideKeys
): Map<string, JsonObject> => {
  const map = new Map<string, JsonObject>()
  for (let index = 0; index < keys.length; index++) {
    map.set(keys[index], entries[index] as JsonObject)
  }
  return map
}

/**
 * Fused pass: builds a keyed Map of each array AND collects the union of
 * keys in a single traversal per array, instead of three `buildKeyedMap`
 * calls plus a separate pass over every key.
 */
export const indexKeyedArrays = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
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

  const fill = (
    entries: JsonArray,
    sideKeys: SideKeys,
    target: Map<string, JsonObject>
  ): void => {
    for (let index = 0; index < sideKeys.length; index++) {
      const key = sideKeys[index]
      target.set(key, entries[index] as JsonObject)
      allKeys.add(key)
    }
  }

  fill(ancestor, keys.ancestor, keyedAncestor)
  fill(local, keys.local, keyedLocal)
  fill(other, keys.other, keyedOther)

  return { keyedAncestor, keyedLocal, keyedOther, allKeys }
}
