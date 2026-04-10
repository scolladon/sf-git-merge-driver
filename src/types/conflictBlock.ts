import type { JsonArray, JsonObject, JsonValue } from './jsonTypes.js'

export interface ConflictBlock extends JsonObject {
  readonly __conflict: true
  readonly local: JsonArray
  readonly ancestor: JsonArray
  readonly other: JsonArray
}

export const isConflictBlock = (value: JsonValue): value is ConflictBlock =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  '__conflict' in value &&
  (value as ConflictBlock).__conflict === true

export const buildConflictBlock = (
  local: JsonObject | JsonArray,
  ancestor: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): ConflictBlock => ({
  __conflict: true as const,
  local: Array.isArray(local) ? local : [local],
  ancestor: Array.isArray(ancestor) ? ancestor : [ancestor],
  other: Array.isArray(other) ? other : [other],
})
