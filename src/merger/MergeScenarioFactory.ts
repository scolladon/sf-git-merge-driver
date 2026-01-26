import { isEmpty } from 'lodash-es'
import { MergeScenario } from '../types/mergeScenario.js'

export const getScenario = (
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  ancestor: any,
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  local: any,
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  other: any
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
