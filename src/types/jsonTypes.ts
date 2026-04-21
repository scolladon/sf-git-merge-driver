export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray

export interface JsonObject {
  [key: string]: JsonValue
}

export interface JsonArray extends Array<JsonValue> {}

/**
 * Read a string-keyed property from a `JsonObject | JsonArray`. When the
 * value is an array (numerically indexed), returns `undefined` because
 * string keys cannot index an array in the JsonValue shape. Use when you
 * do not control the union side (e.g. types/conflictBlock content); in
 * hot iteration loops prefer narrowing once with `toJsonObjectOrEmpty`
 * and indexing directly to avoid the per-call Array.isArray.
 */
export const getJsonProp = (
  value: JsonObject | JsonArray,
  key: string
): JsonValue | undefined =>
  Array.isArray(value) ? undefined : (value as JsonObject)[key]

/**
 * Narrow a `JsonObject | JsonArray` to a `JsonObject` for downstream
 * per-key iteration. Arrays are mapped to an empty object (they have no
 * string-keyed properties to merge), which is cheaper and less error
 * prone than casting via `as`. Use once at the top of a merge/iteration
 * and then direct-index on the returned value.
 */
export const toJsonObjectOrEmpty = (
  value: JsonObject | JsonArray
): JsonObject => (Array.isArray(value) ? {} : value)
