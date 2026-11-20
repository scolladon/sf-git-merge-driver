import { ATTR_PREFIX } from '../constant/parserConstant.js'
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
  return deepEqual(a, b, hasSameKeys)
}

/**
 * Same as `jsonEqual`, but objects must also list their keys in the same
 * order, for callers whose output order follows the key order.
 */
export function jsonIdentical(a: unknown, b: unknown): boolean {
  return deepEqual(a, b, hasSameKeysInOrder)
}

/**
 * Same as `jsonIdentical`, except that the order of the `@_`-prefixed
 * attribute keys is irrelevant: an element's attributes are a set, its child
 * tags are a sequence.
 */
export function jsonIdenticalUpToAttributeOrder(
  a: unknown,
  b: unknown
): boolean {
  return deepEqual(a, b, hasSameChildOrder)
}

type KeysMatch = (lKeys: string[], rKeys: string[], rObj: JsonObject) => boolean

const hasSameKeys: KeysMatch = (lKeys, rKeys, rObj) => {
  if (lKeys.length !== rKeys.length) return false
  for (const key of lKeys) {
    if (!(key in rObj)) return false
  }
  return true
}

const hasSameKeysInOrder: KeysMatch = (lKeys, rKeys) => {
  if (lKeys.length !== rKeys.length) return false
  // Stryker disable next-line EqualityOperator: the lists are as long, so index length reads undefined on both
  for (let i = 0; i < lKeys.length; i++) {
    if (lKeys[i] !== rKeys[i]) return false
  }
  return true
}

export const isChildKey = (key: string): boolean => !key.startsWith(ATTR_PREFIX)

const hasSameChildOrder: KeysMatch = (lKeys, rKeys, rObj) =>
  hasSameKeys(lKeys, rKeys, rObj) &&
  hasSameKeysInOrder(lKeys.filter(isChildKey), rKeys.filter(isChildKey), rObj)

function deepEqual(a: unknown, b: unknown, keysMatch: KeysMatch): boolean {
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
    if (!keysMatch(lKeys, Object.keys(rObj), rObj)) return false
    for (const key of lKeys) {
      stack.push([lObj[key], rObj[key]])
    }
  }

  return true
}
