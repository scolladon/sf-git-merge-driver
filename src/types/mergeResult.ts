import { isEmpty } from 'lodash-es'
import type { JsonArray } from './jsonTypes.js'

export interface MergeResult {
  output: JsonArray
  hasConflict: boolean
}

const EMPTY_ARRAY: JsonArray = []
const EMPTY_NO_CONFLICT: MergeResult = {
  output: EMPTY_ARRAY,
  hasConflict: false,
}

export const combineResults = (results: MergeResult[]): MergeResult => {
  if (isEmpty(results)) {
    return EMPTY_NO_CONFLICT
  }
  if (results.length === 1) {
    return results[0]
  }
  return {
    output: results.flatMap(r => r.output),
    hasConflict: results.some(r => r.hasConflict),
  }
}

export const noConflict = (output: JsonArray): MergeResult => {
  if (isEmpty(output)) {
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
