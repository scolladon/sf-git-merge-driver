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
 * The stand-in for a side that holds no tags. It has no prototype, so a tag
 * named `constructor`, `toString` or `valueOf` reads as absent instead of as
 * the inherited function.
 */
export const createEmptyBody = (): JsonObject => Object.create(null)

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Narrow any side to a `JsonObject` for downstream per-key iteration.
 * Anything that is not an object (an array, a string, an absent side) has no
 * tags to merge and maps to an empty object: a string cast to an object
 * would be iterated character by character and read `String.prototype`.
 * Use once at the top of a merge/iteration and then direct-index on the
 * returned value.
 */
export const toJsonObjectOrEmpty = (
  value: JsonValue | undefined
): JsonObject => (isJsonObject(value) ? value : createEmptyBody())
