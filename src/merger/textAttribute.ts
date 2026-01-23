import { isNil } from 'lodash-es'
import { TEXT_TAG } from '../constant/parserConstant.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import { getScenario, MergeScenario } from '../types/mergeScenario.js'
import type { ConflictMarker } from './conflictMarker.js'

export const generateObj = (
  value: JsonValue | null,
  attrib: string
): JsonObject => {
  return isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] }
}

export const mergeTextAttribute = (
  conflictMarker: ConflictMarker,
  ancestor: JsonValue | null,
  local: JsonValue | null,
  other: JsonValue | null,
  attrib: string
): JsonArray => {
  const objAncestor: JsonObject = generateObj(ancestor, attrib)
  const objLocal: JsonObject = generateObj(local, attrib)
  const objOther: JsonObject = generateObj(other, attrib)
  const scenario: MergeScenario = getScenario(objAncestor, objLocal, objOther)
  const acc: JsonArray = []

  // Early return for identical values - use strict equality for primitives
  if (
    local === other &&
    (scenario === MergeScenario.LOCAL_AND_OTHER ||
      scenario === MergeScenario.ALL)
  ) {
    return [objLocal]
  }

  // Handle specific merge scenarios
  switch (scenario) {
    case MergeScenario.OTHER_ONLY:
      acc.push(objOther)
      break

    case MergeScenario.LOCAL_ONLY:
      acc.push(objLocal)
      break

    case MergeScenario.LOCAL_AND_OTHER:
      conflictMarker.addConflictMarkers(acc, objLocal, {}, objOther)
      break

    case MergeScenario.ANCESTOR_AND_OTHER:
      if (ancestor !== other) {
        conflictMarker.addConflictMarkers(acc, {}, objAncestor, objOther)
      }
      break

    case MergeScenario.ANCESTOR_AND_LOCAL:
      if (ancestor !== local) {
        conflictMarker.addConflictMarkers(acc, objLocal, objAncestor, {})
      }
      break

    case MergeScenario.ALL:
      if (ancestor === local) {
        acc.push(objOther)
      } else if (ancestor === other) {
        acc.push(objLocal)
      } else {
        conflictMarker.addConflictMarkers(acc, objLocal, objAncestor, objOther)
      }
      break
  }

  return acc
}
