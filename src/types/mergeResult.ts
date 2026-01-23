import type { JsonArray } from './jsonTypes.js'

export interface MergeResult {
  output: JsonArray
  hasConflict: boolean
}

export const combineResults = (results: MergeResult[]): MergeResult => {
  return {
    output: results.flatMap(r => r.output),
    hasConflict: results.some(r => r.hasConflict),
  }
}

export const noConflict = (output: JsonArray): MergeResult => ({
  output,
  hasConflict: false,
})

export const withConflict = (output: JsonArray): MergeResult => ({
  output,
  hasConflict: true,
})
