import type { JsonObject } from '../types/jsonTypes.js'

/**
 * Deep equality for JSON-shaped values (iterative, stack-safe).
 * Accepts `unknown` to match the signature of `fast-equals.deepEqual` it replaces;
 * non-JSON values (functions, symbols, class instances) fall through the primitive/
 * object checks and return false unless strictly `===`.
 *
 * Key order in objects is irrelevant; array element order IS significant
 * (per JSON semantics).
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  const stack: [unknown, unknown][] = [[a, b]]

  while (stack.length > 0) {
    const [left, right] = stack.pop() as [unknown, unknown]

    if (left === right) continue
    if (left === null || right === null) return false
    if (typeof left !== 'object' || typeof right !== 'object') return false

    if (Array.isArray(left)) {
      if (!Array.isArray(right)) return false
      if (left.length !== right.length) return false
      for (let i = left.length - 1; i >= 0; i--) {
        stack.push([left[i], right[i]])
      }
      continue
    }
    if (Array.isArray(right)) return false

    const lObj = left as JsonObject
    const rObj = right as JsonObject
    const lKeys = Object.keys(lObj)
    if (lKeys.length !== Object.keys(rObj).length) return false
    for (const key of lKeys) {
      if (!(key in rObj)) return false
      stack.push([lObj[key], rObj[key]])
    }
  }

  return true
}
