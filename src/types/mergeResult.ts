import { pushAll } from '../utils/arrayUtils.js'
import type { JsonArray, JsonObject, JsonValue } from './jsonTypes.js'

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

// The merge pipeline emits one single-key wrapper per element, but the parser
// groups repeated siblings under one key as `{tag: [entry1, entry2]}`. An early
// (no-op / single-side) result returns that raw shape verbatim; when the body
// is a single such grouped key the writer treats the array as one element's
// body and collapses the repeats into a single element (e.g. CustomLabels whose
// only child is a repeated `<labels>`). Expand it to one wrapper per entry so
// every sibling survives — the writer handles each entry's own body unchanged.
// An empty array is the empty-element shape (self-closed `<tag/>` on
// output) and is left intact.
const expandGroupedRepeats = (value: JsonValue): JsonArray => {
  const keys = Object.keys(value as JsonObject)
  if (keys.length !== 1) {
    return [value] as JsonArray
  }
  const key = keys[0]!
  const inner = (value as JsonObject)[key]
  if (!Array.isArray(inner) || inner.length === 0) {
    return [value] as JsonArray
  }
  return inner.map(entry => ({ [key]: entry })) as JsonArray
}

const FUSABLE_REPEATS = 2

// Only a body that is exactly several repeats of one child is written as one
// element by mistake; any other value stays what it was, as the sides of a
// conflict block are.
export const expandRepeatedChild = (value: JsonValue): JsonValue => {
  // Stryker disable next-line ConditionalExpression: a scalar has no keys, or index keys holding strings, so it never reaches the array test and comes back as it came
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
  const keys = Object.keys(value)
  const inner = keys.length === 1 ? value[keys[0]!] : undefined
  return Array.isArray(inner) && inner.length >= FUSABLE_REPEATS
    ? expandGroupedRepeats(value)
    : value
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
        : expandGroupedRepeats(value)
  if (rootKeyName) {
    return noConflict([{ [rootKeyName]: content }])
  }
  return noConflict(content)
}
