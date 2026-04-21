import { pushAll } from '../utils/arrayUtils.js'
import type { JsonArray, JsonValue } from './jsonTypes.js'

export interface MergeResult {
  readonly output: JsonArray
  readonly hasConflict: boolean
}

const EMPTY_ARRAY: JsonArray = []
const EMPTY_NO_CONFLICT: MergeResult = {
  output: EMPTY_ARRAY,
  hasConflict: false,
}

export const combineResults = (results: MergeResult[]): MergeResult => {
  if (results.length === 1) return results[0]
  const output: JsonArray = []
  let hasConflict = false
  for (const r of results) {
    pushAll(output, r.output)
    hasConflict = hasConflict || r.hasConflict
  }
  return { output, hasConflict }
}

export const noConflict = (output: JsonArray): MergeResult => {
  if (output.length === 0) {
    return EMPTY_NO_CONFLICT
  }
  return { output, hasConflict: false }
}

export const withConflict = (output: JsonArray): MergeResult => ({
  output,
  hasConflict: true,
})

export const isNonEmpty = (result: MergeResult): boolean =>
  result.output.length > 0 || result.hasConflict

export const wrapWithRootKey = (
  result: MergeResult,
  rootKeyName: string
): MergeResult => {
  if (result.output.length > 0) {
    return {
      output: [{ [rootKeyName]: result.output }],
      hasConflict: result.hasConflict,
    }
  }
  return noConflict([{ [rootKeyName]: [] }])
}

export const buildEarlyResult = (
  value: JsonValue | undefined,
  rootKeyName?: string
): MergeResult => {
  const content: JsonArray =
    value == null
      ? []
      : Array.isArray(value)
        ? (value as JsonArray)
        : ([value] as JsonArray)
  if (rootKeyName) {
    return noConflict([{ [rootKeyName]: content }])
  }
  return noConflict(content)
}
