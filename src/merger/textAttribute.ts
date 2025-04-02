import { deepEqual } from 'fast-equals'
import { isNil } from 'lodash-es'
import { TEXT_TAG } from '../constant/conflicConstant.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import { MergeScenario, getScenario } from '../types/mergeScenario.js'
import { ConflictMarker } from './conflictMarker.js'

export const generateObj = (
  value: JsonValue | null,
  attrib: string
): JsonObject => {
  return isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] }
}

export const mergeTextAttribute = (
  ancestor: JsonValue | null,
  ours: JsonValue | null,
  theirs: JsonValue | null,
  attrib: string
): JsonArray => {
  const objAnc: JsonObject = generateObj(ancestor, attrib)
  const objOurs: JsonObject = generateObj(ours, attrib)
  const objTheirs: JsonObject = generateObj(theirs, attrib)
  const scenario: MergeScenario = getScenario(objAnc, objOurs, objTheirs)
  const acc: JsonArray = []

  // Early return for identical values
  if (
    deepEqual(ours, theirs) &&
    (scenario === MergeScenario.OURS_AND_THEIRS ||
      scenario === MergeScenario.ALL)
  ) {
    return [objOurs]
  }

  // Handle specific merge scenarios
  switch (scenario) {
    case MergeScenario.THEIRS_ONLY:
      acc.push(objTheirs)
      break

    case MergeScenario.OURS_ONLY:
      acc.push(objOurs)
      break

    case MergeScenario.OURS_AND_THEIRS:
      ConflictMarker.addConflictMarkers(acc, objOurs, {}, objTheirs)
      break

    case MergeScenario.ANCESTOR_AND_THEIRS:
      if (ancestor !== theirs) {
        ConflictMarker.addConflictMarkers(acc, {}, objAnc, objTheirs)
      }
      break

    case MergeScenario.ANCESTOR_AND_OURS:
      if (ancestor !== ours) {
        ConflictMarker.addConflictMarkers(acc, objOurs, objAnc, {})
      }
      break

    case MergeScenario.ALL:
      if (ancestor === ours) {
        acc.push(objTheirs)
      } else if (ancestor === theirs) {
        acc.push(objOurs)
      } else {
        ConflictMarker.addConflictMarkers(acc, objOurs, objAnc, objTheirs)
      }
      break
  }

  return acc
}
