import type { JsonValue } from '../types/jsonTypes.js'
import { MergeScenario } from '../types/mergeScenario.js'

const isPresent = (value: JsonValue | undefined): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export const getScenario = (
  ancestor: JsonValue | undefined,
  local: JsonValue | undefined,
  other: JsonValue | undefined
): MergeScenario => {
  let scenario = MergeScenario.NONE as number
  if (isPresent(ancestor)) {
    scenario |= MergeScenario.ANCESTOR_ONLY
  }
  if (isPresent(local)) {
    scenario |= MergeScenario.LOCAL_ONLY
  }
  if (isPresent(other)) {
    scenario |= MergeScenario.OTHER_ONLY
  }
  return scenario as MergeScenario
}
