import { deepEqual } from 'fast-equals'
import { isEmpty, keyBy } from 'lodash-es'
import { MetadataService } from '../service/MetadataService.js'
import { NamespaceHandler } from '../service/NamespaceHandler.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { MergeScenario, getScenario } from '../types/mergeScenario.js'
import {
  ensureArray,
  getUniqueSortedProps,
  isObject,
} from '../utils/mergeUtils.js'
import { ConflictMarker } from './conflictMarker.js'
import { generateObj, mergeTextAttribute } from './textAttribute.js'

export class JsonMerger {
  public merge(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean } {
    const namespaceHandler = new NamespaceHandler()
    const namespaces = namespaceHandler.processNamespaces(
      ancestor,
      local,
      other
    )
    const scenario: MergeScenario = getScenario(ancestor, local, other)
    const acc: JsonArray[] = []
    const props = getUniqueSortedProps(ancestor, local, other)
    for (const key of props) {
      switch (scenario) {
        case MergeScenario.ANCESTOR_ONLY:
          break
        case MergeScenario.LOCAL_AND_OTHER:
          acc.push(handlelocalAndother(key, local, other))
          break
        case MergeScenario.ANCESTOR_AND_OTHER:
          acc.push(handleAncestorAndother(key, ancestor, other))
          break
        case MergeScenario.ANCESTOR_AND_LOCAL:
          acc.push(handleAncestorAndlocal(key, ancestor, local))
          break
        default: {
          const obj = {
            [key]: mergeThreeWay(ancestor[key], local[key], other[key]),
          }
          acc.push([obj])
          break
        }
      }
    }

    const result = acc.flat()
    namespaceHandler.addNamespacesToResult(result, namespaces)
    return {
      output: result,
      hasConflict: ConflictMarker.hasConflictMarker(),
    }
  }
}

function mergeThreeWay(
  ancestor: JsonObject | JsonArray,
  local: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): JsonArray {
  const acc: JsonArray[] = []
  const props = getUniqueSortedProps(ancestor, local, other)
  for (const key of props) {
    let values: JsonArray = []
    const ancestorOfKey = ancestor[key]
    const localOfKey = local[key]
    const otherOfKey = other[key]

    if (isObject(ancestorOfKey, localOfKey, otherOfKey)) {
      const [ancestorkey, ourkey, theirkey] = [
        ancestorOfKey,
        localOfKey,
        otherOfKey,
      ].map(ensureArray)
      values = mergeArrays(ancestorkey, ourkey, theirkey, key)
    } else {
      values = mergeTextAttribute(ancestorOfKey, localOfKey, otherOfKey, key)
    }
    acc.push(values)
  }

  return acc.flat()
}

function toJsonArray(inputObj: JsonObject | JsonArray): JsonArray {
  const acc: JsonArray[] = []
  for (const attribute of getUniqueSortedProps(inputObj)) {
    const values: JsonArray = []
    const inputObjOfAttr = inputObj[attribute]

    if (typeof inputObjOfAttr === 'object') {
      const inputObjAtt = ensureArray(inputObjOfAttr)
      for (const key of getUniqueSortedProps(inputObjAtt)) {
        const inputObjKeyOfKey = inputObjAtt[key]
        values.push({ [attribute]: toJsonArray(inputObjKeyOfKey) })
      }
    } else {
      values.push(generateObj(inputObjOfAttr, attribute))
    }
    acc.push(values)
  }

  return acc.flat()
}

const handlelocalAndother = (
  key: string,
  local: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): JsonArray => {
  const obj: JsonObject = {}
  obj[key] = toJsonArray(local[key])
  const acc: JsonArray = []
  if (!deepEqual(local, other)) {
    const otherProp = {
      [key]: toJsonArray(other[key]),
    }
    ConflictMarker.addConflictMarkers(acc, obj, {}, otherProp)
  } else {
    acc.push(obj)
  }
  return acc
}

const handleAncestorAndother = (
  key: string,
  ancestor: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): JsonArray => {
  const acc: JsonArray = []
  if (!deepEqual(ancestor, other)) {
    const ancestorProp = {
      [key]: toJsonArray(ancestor[key]),
    }
    const otherProp = {
      [key]: toJsonArray(other[key]),
    }
    ConflictMarker.addConflictMarkers(acc, {}, ancestorProp, otherProp)
  }
  return acc
}

const handleAncestorAndlocal = (
  key: string,
  ancestor: JsonObject | JsonArray,
  local: JsonObject | JsonArray
): JsonArray => {
  const acc: JsonArray = []
  if (!deepEqual(ancestor, local)) {
    const localProp = {
      [key]: toJsonArray(local[key]),
    }
    const ancestorProp = {
      [key]: toJsonArray(ancestor[key]),
    }
    ConflictMarker.addConflictMarkers(acc, localProp, ancestorProp, {})
  }
  return acc
}

const mergeArrays = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  attribute: string
): JsonArray => {
  const keyField = MetadataService.getKeyFieldExtractor(attribute)
  if (!keyField) {
    // const scenario: MergeScenario = getScenario(ancestor, local, other)
    const arr: JsonArray = []
    // obj[attribute] = unionWith(local, other, deepEqual)
    // obj[attribute] = mergeTextAttribute(local, other, deepEqual, attribute)
    // obj[attribute] = []
    ConflictMarker.addConflictMarkers(
      arr,
      toJsonArray({ [attribute]: local }),
      toJsonArray({ [attribute]: ancestor }),
      toJsonArray({ [attribute]: other })
    )
    return arr.flat()
    // return mergeTextAttribute(ancestor, local, other, attribute).flat()
  }

  const [keyedAnc, keyedlocal, keyedother] = [ancestor, local, other].map(arr =>
    keyBy(arr, keyField)
  )
  return mergeByKeyField(keyedAnc, keyedlocal, keyedother, attribute)
}

const mergeByKeyField = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  attribute: string
): JsonArray => {
  const acc: JsonArray = []
  const props = getUniqueSortedProps(ancestor, local, other)
  for (const key of props) {
    const ancestorOfKey = ancestor[key]
    const localOfKey = local[key]
    const otherOfKey = other[key]
    const scenario: MergeScenario = getScenario(
      ancestorOfKey,
      localOfKey,
      otherOfKey
    )
    const obj = {}
    switch (scenario) {
      case MergeScenario.OTHER_ONLY:
        obj[attribute] = mergeThreeWay({}, {}, otherOfKey)
        break
      case MergeScenario.LOCAL_ONLY:
        obj[attribute] = mergeThreeWay({}, localOfKey, {})
        break
      case MergeScenario.ANCESTOR_ONLY:
        break
      case MergeScenario.LOCAL_AND_OTHER:
        if (deepEqual(localOfKey, otherOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, otherOfKey)
        } else {
          obj[attribute] = mergeThreeWay({}, localOfKey, otherOfKey)
        }
        break
      case MergeScenario.ANCESTOR_AND_OTHER:
        if (!deepEqual(ancestorOfKey, otherOfKey)) {
          const ancestorProp = {
            [attribute]: mergeThreeWay({}, ancestorOfKey, {}),
          }
          const otherProp = {
            [attribute]: mergeThreeWay({}, {}, otherOfKey),
          }
          ConflictMarker.addConflictMarkers(acc, {}, ancestorProp, otherProp)
        }
        break
      case MergeScenario.ANCESTOR_AND_LOCAL:
        if (!deepEqual(ancestorOfKey, localOfKey)) {
          const localProp = {
            [attribute]: mergeThreeWay({}, localOfKey, {}),
          }
          const ancestorProp = {
            [attribute]: mergeThreeWay({}, ancestorOfKey, {}),
          }
          ConflictMarker.addConflictMarkers(acc, localProp, ancestorProp, {})
        }
        break
      case MergeScenario.ALL:
        if (deepEqual(localOfKey, otherOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, otherOfKey)
        } else if (deepEqual(ancestorOfKey, localOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, otherOfKey)
        } else if (deepEqual(ancestorOfKey, otherOfKey)) {
          obj[attribute] = mergeThreeWay({}, localOfKey, {})
        } else {
          obj[attribute] = mergeThreeWay(ancestorOfKey, localOfKey, otherOfKey)
        }
        break
    }
    if (!isEmpty(obj)) {
      acc.push(obj)
    }
  }

  return acc
}
