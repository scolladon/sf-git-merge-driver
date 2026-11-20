import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'

export type KeyExtractor = (item: JsonObject) => string | undefined

// Aligned by index with the side's entries; `undefined` marks a keyless one.
export type ExtractedKeys = readonly (string | undefined)[]

// Aligned by index with the side's entries.
export type SideKeys = readonly string[]

export interface KeyedSides {
  readonly ancestor: SideKeys
  readonly local: SideKeys
  readonly other: SideKeys
}

export const extractKeys = (
  side: JsonArray,
  keyOf: KeyExtractor
): ExtractedKeys => side.map(item => keyOf(item as JsonObject))

// Defined only when every entry has a key: a keyless entry is identified by
// its content, not by a key, so the array leaves the keyed path.
export const toSideKeys = (keys: ExtractedKeys): SideKeys | undefined =>
  keys.every(key => key !== undefined) ? (keys as SideKeys) : undefined
