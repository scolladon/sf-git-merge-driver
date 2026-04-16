import type { JsonObject } from '../types/jsonTypes.js'

/**
 * Deep equality for JSON-shaped values.
 * Accepts `unknown` to match the signature of `fast-equals.deepEqual` it replaces;
 * non-JSON values (functions, symbols, class instances) fall through the primitive/
 * object checks and return false unless strictly `===`.
 *
 * Key order in objects is irrelevant; array element order IS significant
 * (per JSON semantics).
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((element, index) => jsonEqual(element, b[index]))
  }
  if (Array.isArray(b)) return false

  const aObj = a as JsonObject
  const bObj = b as JsonObject
  const aKeys = Object.keys(aObj)
  if (aKeys.length !== Object.keys(bObj).length) return false
  return aKeys.every(key => key in bObj && jsonEqual(aObj[key], bObj[key]))
}
