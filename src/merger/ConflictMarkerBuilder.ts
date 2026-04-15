import {
  buildConflictBlock,
  type ConflictBlock,
} from '../types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

const hasNoContent = (x: JsonObject | JsonArray): boolean =>
  Array.isArray(x) ? x.length === 0 : Object.keys(x).length === 0

export const buildConflictMarkers = (
  local: JsonObject | JsonArray,
  ancestor: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): ConflictBlock => {
  const localValue = hasNoContent(local) ? {} : local
  const ancestorValue = hasNoContent(ancestor) ? {} : ancestor
  const otherValue = hasNoContent(other) ? {} : other

  return buildConflictBlock(localValue, ancestorValue, otherValue)
}
