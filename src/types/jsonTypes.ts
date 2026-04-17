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
 * string keys cannot index an array in the JsonValue shape. Callers that
 * know the side is an object should still receive `JsonValue` — narrowing
 * via `Array.isArray` at each call site is ergonomically noisy.
 */
export const getJsonProp = (
  value: JsonObject | JsonArray,
  key: string
): JsonValue | undefined =>
  Array.isArray(value) ? undefined : (value as JsonObject)[key]
