import {
  castArray,
  flatMap,
  flow,
  isNil,
  isObject,
  reject,
  sortBy,
  uniq,
} from 'lodash-es'
import { TEXT_TAG } from '../../constant/parserConstant.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'

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
): JsonObject => (isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] })

export const toJsonArray = (inputObj: JsonObject | JsonArray): JsonArray =>
  flatMap(getUniqueSortedProps(inputObj), attribute => {
    const inputObjOfAttr = inputObj[attribute]

    if (isObject(inputObjOfAttr)) {
      const inputObjArr = ensureArray(inputObjOfAttr)
      return flatMap(getUniqueSortedProps(inputObjArr), key => {
        const value = inputObjArr[key]
        return isObject(value)
          ? { [attribute]: toJsonArray(value as JsonObject | JsonArray) }
          : generateObj(value, attribute)
      })
    }

    return generateObj(inputObjOfAttr, attribute)
  })
