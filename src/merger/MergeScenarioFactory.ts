import { isEmpty } from 'lodash-es'
import type { JsonValue } from '../types/jsonTypes.js'
import { MergeScenario } from '../types/mergeScenario.js'

export const getScenario = (
  ancestor: JsonValue,
  local: JsonValue,
  other: JsonValue
): MergeScenario => {
  let scenario: MergeScenario = MergeScenario.NONE
  if (!isEmpty(ancestor)) {
    scenario += 100
  }
  if (!isEmpty(local)) {
    scenario += 10
  }
  if (!isEmpty(other)) {
    scenario += 1
  }
  return scenario
}
