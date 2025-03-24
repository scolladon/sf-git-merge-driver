import { isEmpty, isEqual, keyBy, unionWith } from 'lodash-es'
import { MetadataService } from '../service/MetadataService.js'
import { NamespaceHandler } from '../service/NamespaceHandler.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { MergeScenario, getScenario } from '../types/mergeScenario.js'
import {
  ensureArray,
  getUniqueSortedProps,
  isObject,
} from '../utils/mergeUtils.js'
import { addConflictMarkers } from './conflictMarker.js'
import { mergeTextAttribute } from './textAttribute.js'

export class JsonMerger {
  public merge(
    ancestor: JsonObject | JsonArray,
    ours: JsonObject | JsonArray,
    theirs: JsonObject | JsonArray
  ): JsonArray {
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
            [key]: mergeMetadata(ancestor[key], ours[key], theirs[key]),
          }
          acc.push([obj])
          break
        }
      }
    }

    const result = acc.flat()
    namespaceHandler.addNamespacesToResult(result, namespaces)
    return result
  }
}
const mergeMetadata = (
  ancestor: JsonObject | JsonArray,
  ours: JsonObject | JsonArray,
  theirs: JsonObject | JsonArray
): JsonArray => {
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

const handleOursAndTheirs = (
  key: string,
  ours: JsonObject | JsonArray,
  theirs: JsonObject | JsonArray
): JsonArray => {
  const obj: JsonObject = {}
  obj[key] = mergeMetadata({}, ours[key], {})
  const acc: JsonArray = []
  if (!isEqual(ours, theirs)) {
    const theirsProp = {
      [key]: mergeMetadata({}, {}, theirs[key]),
    }
    addConflictMarkers(acc, obj, {}, theirsProp)
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
  if (!isEqual(ancestor, theirs)) {
    const ancestorProp = {
      [key]: mergeMetadata({}, {}, ancestor[key]),
    }
    const theirsProp = {
      [key]: mergeMetadata({}, {}, theirs[key]),
    }
    addConflictMarkers(acc, {}, ancestorProp, theirsProp)
  }
  return acc
}

const handleAncestorAndOurs = (
  key: string,
  ancestor: JsonObject | JsonArray,
  ours: JsonObject | JsonArray
): JsonArray => {
  const acc: JsonArray = []
  if (!isEqual(ancestor, ours)) {
    const oursProp = {
      [key]: mergeMetadata({}, {}, ours[key]),
    }
    const ancestorProp = {
      [key]: mergeMetadata({}, {}, ancestor[key]),
    }
    addConflictMarkers(acc, oursProp, ancestorProp, {})
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
    const obj = {}
    obj[attribute] = unionWith(ours, theirs, isEqual)
    return [obj]
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
        obj[attribute] = mergeMetadata({}, {}, theirsOfKey)
        break
      case MergeScenario.OURS_ONLY:
        obj[attribute] = mergeMetadata({}, oursOfKey, {})
        break
      case MergeScenario.ANCESTOR_ONLY:
        break
      case MergeScenario.OURS_AND_THEIRS:
        if (isEqual(oursOfKey, theirsOfKey)) {
          obj[attribute] = mergeMetadata({}, {}, theirsOfKey)
        } else {
          obj[attribute] = mergeMetadata({}, oursOfKey, theirsOfKey)
        }
        break
      case MergeScenario.ANCESTOR_AND_THEIRS:
        if (!isEqual(ancestorOfKey, theirsOfKey)) {
          const ancestorProp = {
            [attribute]: mergeMetadata({}, ancestorOfKey, {}),
          }
          const theirsProp = {
            [attribute]: mergeMetadata({}, {}, theirsOfKey),
          }
          addConflictMarkers(acc, {}, ancestorProp, theirsProp)
        }
        break
      case MergeScenario.ANCESTOR_AND_OURS:
        if (!isEqual(ancestorOfKey, oursOfKey)) {
          const oursProp = {
            [attribute]: mergeMetadata({}, oursOfKey, {}),
          }
          const ancestorProp = {
            [attribute]: mergeMetadata({}, ancestorOfKey, {}),
          }
          addConflictMarkers(acc, oursProp, ancestorProp, {})
        }
        break
      case MergeScenario.ALL:
        if (isEqual(oursOfKey, theirsOfKey)) {
          obj[attribute] = mergeMetadata({}, {}, theirsOfKey)
        } else if (isEqual(ancestorOfKey, oursOfKey)) {
          obj[attribute] = mergeMetadata({}, {}, theirsOfKey)
        } else if (isEqual(ancestorOfKey, theirsOfKey)) {
          obj[attribute] = mergeMetadata({}, oursOfKey, {})
        } else {
          obj[attribute] = mergeMetadata(ancestorOfKey, oursOfKey, theirsOfKey)
        }
        break
    }
    if (!isEmpty(obj)) {
      acc.push(obj)
    }
  }

  return acc
}
