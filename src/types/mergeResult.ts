import type { JsonArray } from './jsonTypes.js'

export interface MergeResult {
  output: JsonArray
  hasConflict: boolean
}

// Pre-allocated constant for the common empty no-conflict case
// Used by NoneStrategy, AncestorOnlyStrategy, and equality-based early returns
const EMPTY_ARRAY: JsonArray = []
const EMPTY_NO_CONFLICT: MergeResult = {
  output: EMPTY_ARRAY,
  hasConflict: false,
}

export const combineResults = (results: MergeResult[]): MergeResult => {
  // Fast path: no results
  if (results.length === 0) {
    return EMPTY_NO_CONFLICT
  }
  // Fast path: single result
  if (results.length === 1) {
    return results[0]
  }
  return {
    output: results.flatMap(r => r.output),
    hasConflict: results.some(r => r.hasConflict),
  }
}

export const noConflict = (output: JsonArray): MergeResult => {
  // Reuse constant for empty arrays
  if (output.length === 0) {
    return EMPTY_NO_CONFLICT
  }
  return { output, hasConflict: false }
}

export const withConflict = (output: JsonArray): MergeResult => ({
  output,
  hasConflict: true,
})
