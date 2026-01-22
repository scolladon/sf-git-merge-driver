import { deepEqual } from 'fast-equals'
import { isEmpty, keyBy } from 'lodash-es'
import { MetadataService } from '../service/MetadataService.js'
import { NamespaceHandler } from '../service/NamespaceHandler.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { getScenario, MergeScenario } from '../types/mergeScenario.js'
import { log } from '../utils/LoggingDecorator.js'
import {
  ensureArray,
  getUniqueSortedProps,
  isObject,
  isStringArray,
} from '../utils/mergeUtils.js'
import { ConflictMarker } from './conflictMarker.js'
import { generateObj, mergeTextAttribute } from './textAttribute.js'

export class JsonMerger {
  @log
  public mergeThreeWay(
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
          acc.push(handleLocalAndOther(key, local, other))
          break
        case MergeScenario.ANCESTOR_AND_OTHER:
          acc.push(handleAncestorAndOther(key, ancestor, other))
          break
        case MergeScenario.ANCESTOR_AND_LOCAL:
          acc.push(handleAncestorAndLocal(key, ancestor, local))
          break
        default: {
          const obj = {
            [key]: merge(ancestor[key], local[key], other[key]),
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

function merge(
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

    const [ancestorArr, localArr, otherArr] = [
      ancestorOfKey,
      localOfKey,
      otherOfKey,
    ].map(ensureArray)
    if (isStringArray(ancestorOfKey, localOfKey, otherOfKey)) {
      values = mergeTextArrays(ancestorArr, localArr, otherArr, key)
    } else if (isObject(ancestorOfKey, localOfKey, otherOfKey)) {
      values = mergeArrays(ancestorArr, localArr, otherArr, key)
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

const handleLocalAndOther = (
  key: string,
  local: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): JsonArray => {
  const obj: JsonObject = {}
  obj[key] = merge({}, local[key], other[key])
  const acc: JsonArray = []
  // Functional choice: Don't use deepEqual because it would tax performence when the ancestor is empty at a too high level of the metadata tree
  // merge will functionally do the same itself while perfoming its normal function
  acc.push(obj)
  return acc
}

const handleAncestorAndOther = (
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

const handleAncestorAndLocal = (
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
    const arr: JsonArray = []
    ConflictMarker.addConflictMarkers(
      arr,
      toJsonArray({ [attribute]: local }),
      toJsonArray({ [attribute]: ancestor }),
      toJsonArray({ [attribute]: other })
    )
    return arr.flat()
  }

  const [keyedAncestor, keyedLocal, keyedOther] = [ancestor, local, other].map(
    arr => keyBy(arr, keyField)
  )
  return mergeByKeyField(keyedAncestor, keyedLocal, keyedOther, attribute)
}

const mergeTextArrays = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  attribute: string
): JsonArray => {
  const localSet = new Set(local)
  const otherSet = new Set(other)

  // Simplest way to merge without removed elements
  const removedInLocal = ancestor.filter(item => !localSet.has(item))
  const removedInOther = ancestor.filter(item => !otherSet.has(item))
  const removedSet = new Set([...removedInLocal, ...removedInOther])

  const merged = [...new Set([...ancestor, ...local, ...other])]
    .filter(item => !removedSet.has(item))
    .sort()
    .map(item => generateObj(item, attribute))
  const obj: JsonArray = [{ [attribute]: merged }]

  return isEmpty(merged) ? [] : obj
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
        obj[attribute] = merge({}, {}, otherOfKey)
        break
      case MergeScenario.LOCAL_ONLY:
        obj[attribute] = merge({}, localOfKey, {})
        break
      case MergeScenario.ANCESTOR_ONLY:
        break
      case MergeScenario.LOCAL_AND_OTHER:
        if (deepEqual(localOfKey, otherOfKey)) {
          obj[attribute] = merge({}, {}, otherOfKey)
        } else {
          obj[attribute] = merge({}, localOfKey, otherOfKey)
        }
        break
      case MergeScenario.ANCESTOR_AND_OTHER:
        if (!deepEqual(ancestorOfKey, otherOfKey)) {
          const ancestorProp = {
            [attribute]: merge({}, ancestorOfKey, {}),
          }
          const otherProp = {
            [attribute]: merge({}, {}, otherOfKey),
          }
          ConflictMarker.addConflictMarkers(acc, {}, ancestorProp, otherProp)
        }
        break
      case MergeScenario.ANCESTOR_AND_LOCAL:
        if (!deepEqual(ancestorOfKey, localOfKey)) {
          const localProp = {
            [attribute]: merge({}, localOfKey, {}),
          }
          const ancestorProp = {
            [attribute]: merge({}, ancestorOfKey, {}),
          }
          ConflictMarker.addConflictMarkers(acc, localProp, ancestorProp, {})
        }
        break
      case MergeScenario.ALL:
        if (deepEqual(localOfKey, otherOfKey)) {
          obj[attribute] = merge({}, {}, otherOfKey)
        } else if (deepEqual(ancestorOfKey, localOfKey)) {
          obj[attribute] = merge({}, {}, otherOfKey)
        } else if (deepEqual(ancestorOfKey, otherOfKey)) {
          obj[attribute] = merge({}, localOfKey, {})
        } else {
          obj[attribute] = merge(ancestorOfKey, localOfKey, otherOfKey)
        }
        break
    }
    if (!isEmpty(obj)) {
      acc.push(obj)
    }
  }

  return acc
}
