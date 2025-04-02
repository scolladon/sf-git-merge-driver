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
    ours: JsonObject | JsonArray,
    theirs: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean } {
    const namespaceHandler = new NamespaceHandler()
    const namespaces = namespaceHandler.processNamespaces(
      ancestor,
      ours,
      theirs
    )
    const scenario: MergeScenario = getScenario(ancestor, ours, theirs)
    const acc: JsonArray[] = []
    const props = getUniqueSortedProps(ancestor, ours, theirs)
    for (const key of props) {
      switch (scenario) {
        case MergeScenario.ANCESTOR_ONLY:
          break
        case MergeScenario.OURS_AND_THEIRS:
          acc.push(handleOursAndTheirs(key, ours, theirs))
          break
        case MergeScenario.ANCESTOR_AND_THEIRS:
          acc.push(handleAncestorAndTheirs(key, ancestor, theirs))
          break
        case MergeScenario.ANCESTOR_AND_OURS:
          acc.push(handleAncestorAndOurs(key, ancestor, ours))
          break
        default: {
          const obj = {
            [key]: mergeThreeWay(ancestor[key], ours[key], theirs[key]),
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
  ours: JsonObject | JsonArray,
  theirs: JsonObject | JsonArray
): JsonArray {
  const acc: JsonArray[] = []
  const props = getUniqueSortedProps(ancestor, ours, theirs)
  for (const key of props) {
    let values: JsonArray = []
    const ancestorOfKey = ancestor[key]
    const oursOfKey = ours[key]
    const theirsOfKey = theirs[key]

    if (isObject(ancestorOfKey, oursOfKey, theirsOfKey)) {
      const [ancestorkey, ourkey, theirkey] = [
        ancestorOfKey,
        oursOfKey,
        theirsOfKey,
      ].map(ensureArray)
      values = mergeArrays(ancestorkey, ourkey, theirkey, key)
    } else {
      values = mergeTextAttribute(ancestorOfKey, oursOfKey, theirsOfKey, key)
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

const handleOursAndTheirs = (
  key: string,
  ours: JsonObject | JsonArray,
  theirs: JsonObject | JsonArray
): JsonArray => {
  const obj: JsonObject = {}
  obj[key] = toJsonArray(ours[key])
  const acc: JsonArray = []
  if (!deepEqual(ours, theirs)) {
    const theirsProp = {
      [key]: toJsonArray(theirs[key]),
    }
    ConflictMarker.addConflictMarkers(acc, obj, {}, theirsProp)
  } else {
    acc.push(obj)
  }
  return acc
}

const handleAncestorAndTheirs = (
  key: string,
  ancestor: JsonObject | JsonArray,
  theirs: JsonObject | JsonArray
): JsonArray => {
  const acc: JsonArray = []
  if (!deepEqual(ancestor, theirs)) {
    const ancestorProp = {
      [key]: toJsonArray(ancestor[key]),
    }
    const theirsProp = {
      [key]: toJsonArray(theirs[key]),
    }
    ConflictMarker.addConflictMarkers(acc, {}, ancestorProp, theirsProp)
  }
  return acc
}

const handleAncestorAndOurs = (
  key: string,
  ancestor: JsonObject | JsonArray,
  ours: JsonObject | JsonArray
): JsonArray => {
  const acc: JsonArray = []
  if (!deepEqual(ancestor, ours)) {
    const oursProp = {
      [key]: toJsonArray(ours[key]),
    }
    const ancestorProp = {
      [key]: toJsonArray(ancestor[key]),
    }
    ConflictMarker.addConflictMarkers(acc, oursProp, ancestorProp, {})
  }
  return acc
}

const mergeArrays = (
  ancestor: JsonArray,
  ours: JsonArray,
  theirs: JsonArray,
  attribute: string
): JsonArray => {
  const keyField = MetadataService.getKeyFieldExtractor(attribute)
  if (!keyField) {
    // const scenario: MergeScenario = getScenario(ancestor, ours, theirs)
    const arr: JsonArray = []
    // obj[attribute] = unionWith(ours, theirs, deepEqual)
    // obj[attribute] = mergeTextAttribute(ours, theirs, deepEqual, attribute)
    // obj[attribute] = []
    ConflictMarker.addConflictMarkers(
      arr,
      toJsonArray({ [attribute]: ours }),
      toJsonArray({ [attribute]: ancestor }),
      toJsonArray({ [attribute]: theirs })
    )
    return arr.flat()
    // return mergeTextAttribute(ancestor, ours, theirs, attribute).flat()
  }

  const [keyedAnc, keyedOurs, keyedTheirs] = [ancestor, ours, theirs].map(arr =>
    keyBy(arr, keyField)
  )
  return mergeByKeyField(keyedAnc, keyedOurs, keyedTheirs, attribute)
}

const mergeByKeyField = (
  ancestor: JsonArray,
  ours: JsonArray,
  theirs: JsonArray,
  attribute: string
): JsonArray => {
  const acc: JsonArray = []
  const props = getUniqueSortedProps(ancestor, ours, theirs)
  for (const key of props) {
    const ancestorOfKey = ancestor[key]
    const oursOfKey = ours[key]
    const theirsOfKey = theirs[key]
    const scenario: MergeScenario = getScenario(
      ancestorOfKey,
      oursOfKey,
      theirsOfKey
    )
    const obj = {}
    switch (scenario) {
      case MergeScenario.THEIRS_ONLY:
        obj[attribute] = mergeThreeWay({}, {}, theirsOfKey)
        break
      case MergeScenario.OURS_ONLY:
        obj[attribute] = mergeThreeWay({}, oursOfKey, {})
        break
      case MergeScenario.ANCESTOR_ONLY:
        break
      case MergeScenario.OURS_AND_THEIRS:
        if (deepEqual(oursOfKey, theirsOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, theirsOfKey)
        } else {
          obj[attribute] = mergeThreeWay({}, oursOfKey, theirsOfKey)
        }
        break
      case MergeScenario.ANCESTOR_AND_THEIRS:
        if (!deepEqual(ancestorOfKey, theirsOfKey)) {
          const ancestorProp = {
            [attribute]: mergeThreeWay({}, ancestorOfKey, {}),
          }
          const theirsProp = {
            [attribute]: mergeThreeWay({}, {}, theirsOfKey),
          }
          ConflictMarker.addConflictMarkers(acc, {}, ancestorProp, theirsProp)
        }
        break
      case MergeScenario.ANCESTOR_AND_OURS:
        if (!deepEqual(ancestorOfKey, oursOfKey)) {
          const oursProp = {
            [attribute]: mergeThreeWay({}, oursOfKey, {}),
          }
          const ancestorProp = {
            [attribute]: mergeThreeWay({}, ancestorOfKey, {}),
          }
          ConflictMarker.addConflictMarkers(acc, oursProp, ancestorProp, {})
        }
        break
      case MergeScenario.ALL:
        if (deepEqual(oursOfKey, theirsOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, theirsOfKey)
        } else if (deepEqual(ancestorOfKey, oursOfKey)) {
          obj[attribute] = mergeThreeWay({}, {}, theirsOfKey)
        } else if (deepEqual(ancestorOfKey, theirsOfKey)) {
          obj[attribute] = mergeThreeWay({}, oursOfKey, {})
        } else {
          obj[attribute] = mergeThreeWay(ancestorOfKey, oursOfKey, theirsOfKey)
        }
        break
    }
    if (!isEmpty(obj)) {
      acc.push(obj)
    }
  }

  return acc
}
