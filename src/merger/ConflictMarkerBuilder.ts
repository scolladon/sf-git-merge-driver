import {
  buildConflictBlock,
  type ConflictBlock,
} from '../types/conflictBlock.js'
import type { JsonArray, JsonValue } from '../types/jsonTypes.js'

const isNothing = (content: JsonValue): boolean =>
  content === null ||
  (typeof content === 'object' && Object.keys(content).length === 0)

const toSide = (content: JsonValue): JsonArray => {
  if (Array.isArray(content)) {
    return content
  }
  return isNothing(content) ? [] : [content]
}

export const buildConflictMarkers = (
  local: JsonValue,
  ancestor: JsonValue,
  other: JsonValue
): ConflictBlock =>
  buildConflictBlock(toSide(local), toSide(ancestor), toSide(other))
