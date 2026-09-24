import type { JsonValue } from '../types/jsonTypes.js'
import { MergeScenario } from '../types/mergeScenario.js'

const isPresent = (value: JsonValue | undefined): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

// A scalar side has no wrapper object to be empty: only null/undefined are
// absent. This mirrors getScenario(toObj(v)) for a scalar v, where
// toObj('') is { [attr]: '' } and therefore present.
const isScalarPresent = (value: JsonValue | undefined): boolean => value != null

const scenarioOf =
  (present: (value: JsonValue | undefined) => boolean) =>
  (
    ancestor: JsonValue | undefined,
    local: JsonValue | undefined,
    other: JsonValue | undefined
  ): MergeScenario => {
    let scenario = MergeScenario.NONE as number
    if (present(ancestor)) {
      scenario |= MergeScenario.ANCESTOR_ONLY
    }
    if (present(local)) {
      scenario |= MergeScenario.LOCAL_ONLY
    }
    if (present(other)) {
      scenario |= MergeScenario.OTHER_ONLY
    }
    return scenario as MergeScenario
  }

export const getScenario = scenarioOf(isPresent)
export const getScalarScenario = scenarioOf(isScalarPresent)
