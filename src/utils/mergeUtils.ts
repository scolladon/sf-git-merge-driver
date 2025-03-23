import { castArray, isNil } from 'lodash-es'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'

export const isObject = (
  ancestor: JsonValue | undefined | null,
  ours: JsonValue | undefined | null,
  theirs: JsonValue | undefined | null
): boolean =>
  typeof [ancestor, theirs, ours].find(ele => !isNil(ele)) === 'object'

export const ensureArray = (value: JsonValue): JsonArray =>
  isNil(value) ? [] : (castArray(value) as JsonArray)

export const getUniqueSortedProps = (
  ...objects: (JsonObject | JsonArray)[]
): string[] => Array.from(new Set([...objects].map(Object.keys).flat())).sort()
