import { deepEqual } from 'fast-equals'
import { isNil } from 'lodash-es'
import { TEXT_TAG } from '../constant/parserConstant.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import { getScenario, MergeScenario } from '../types/mergeScenario.js'
import { ConflictMarker } from './conflictMarker.js'

export const generateObj = (
  value: JsonValue | null,
  attrib: string
): JsonObject => {
  return isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] }
}

export const mergeTextAttribute = (
  ancestor: JsonValue | null,
  local: JsonValue | null,
  other: JsonValue | null,
  attrib: string
): JsonArray => {
  // Special handling for API version in package.xml - always take the higher version
  if (attrib === 'version' && local !== other) {
    const localVersion = parseFloat(String(local)) || 0
    const otherVersion = parseFloat(String(other)) || 0
    const higherVersion = Math.max(localVersion, otherVersion).toFixed(1)
    return [generateObj(higherVersion, attrib)]
  }

  const objAnc: JsonObject = generateObj(ancestor, attrib)
  const objlocal: JsonObject = generateObj(local, attrib)
  const objother: JsonObject = generateObj(other, attrib)
  const scenario: MergeScenario = getScenario(objAnc, objlocal, objother)
  const acc: JsonArray = []

  // Early return for identical values
  if (
    deepEqual(local, other) &&
    (scenario === MergeScenario.LOCAL_AND_OTHER ||
      scenario === MergeScenario.ALL)
  ) {
    return [objlocal]
  }

  // Handle specific merge scenarios
  switch (scenario) {
    case MergeScenario.OTHER_ONLY:
      acc.push(objother)
      break

    case MergeScenario.LOCAL_ONLY:
      acc.push(objlocal)
      break

    case MergeScenario.LOCAL_AND_OTHER:
      ConflictMarker.addConflictMarkers(acc, objlocal, {}, objother)
      break

    case MergeScenario.ANCESTOR_AND_OTHER:
      if (ancestor !== other) {
        ConflictMarker.addConflictMarkers(acc, {}, objAnc, objother)
      }
      break

    case MergeScenario.ANCESTOR_AND_LOCAL:
      if (ancestor !== local) {
        ConflictMarker.addConflictMarkers(acc, objlocal, objAnc, {})
      }
      break

    case MergeScenario.ALL:
      if (ancestor === local) {
        acc.push(objother)
      } else if (ancestor === other) {
        acc.push(objlocal)
      } else {
        ConflictMarker.addConflictMarkers(acc, objlocal, objAnc, objother)
      }
      break
  }

  return acc
}
