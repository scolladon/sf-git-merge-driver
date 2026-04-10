import { isEmpty } from 'lodash-es'
import {
  buildConflictBlock,
  type ConflictBlock,
} from '../types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

const emptyContent = (): JsonObject => ({})

export const buildConflictMarkers = (
  local: JsonObject | JsonArray,
  ancestor: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): ConflictBlock => {
  const localValue = isEmpty(local) ? emptyContent() : local
  const ancestorValue = isEmpty(ancestor) ? emptyContent() : ancestor
  const otherValue = isEmpty(other) ? emptyContent() : other

  return buildConflictBlock(localValue, ancestorValue, otherValue)
}
