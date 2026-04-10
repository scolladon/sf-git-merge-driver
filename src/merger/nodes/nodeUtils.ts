import {
  castArray,
  flatMap,
  flow,
  isEmpty,
  isNil,
  reject,
  sortBy,
  uniq,
} from 'lodash-es'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import type { RootKeyInfo } from '../MergeContext.js'

export const ensureArray = (value: JsonValue): JsonArray =>
  isNil(value) ? [] : (castArray(value) as JsonArray)

const extractSortedKeys = flow(
  (objects: (JsonObject | JsonArray)[]) => reject(objects, isNil),
  objects => flatMap(objects, Object.keys),
  uniq,
  sortBy
)

export const getUniqueSortedProps = (
  ...objects: (JsonObject | JsonArray)[]
): string[] => extractSortedKeys(objects)

export const generateObj = (
  value: JsonValue | null,
  attrib: string
): JsonObject => (isNil(value) ? {} : { [attrib]: value })

export const wrapWithRootKey = (
  result: MergeResult,
  rootKeyName: string
): MergeResult => {
  if (!isEmpty(result.output)) {
    return {
      output: [{ [rootKeyName]: result.output }],
      hasConflict: result.hasConflict,
    }
  }
  return noConflict([{ [rootKeyName]: [] }])
}

export const buildEarlyResult = (
  value: JsonValue,
  rootKey?: RootKeyInfo
): MergeResult => {
  const content = ensureArray(value)
  if (rootKey) {
    return noConflict([{ [rootKey.name]: content }])
  }
  return noConflict(content)
}

export type KeyExtractor = (item: JsonObject) => string

export const buildKeyedMap = (
  arr: JsonArray,
  keyField: KeyExtractor
): Map<string, JsonObject> => {
  const map = new Map<string, JsonObject>()
  for (const item of arr) {
    const key = keyField(item as JsonObject)
    map.set(key, item as JsonObject)
  }
  return map
}
