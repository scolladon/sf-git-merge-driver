import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../src/types/jsonTypes.js'
import { jsonEqual } from '../../../src/utils/jsonEqual.js'

describe('jsonEqual', () => {
  describe('primitive equality', () => {
    it('Given two equal strings, When comparing, Then returns true', () => {
      expect(jsonEqual('abc', 'abc')).toBe(true)
    })

    it('Given two equal numbers, When comparing, Then returns true', () => {
      expect(jsonEqual(42, 42)).toBe(true)
    })

    it('Given two equal booleans, When comparing, Then returns true', () => {
      expect(jsonEqual(true, true)).toBe(true)
    })

    it('Given two null values, When comparing, Then returns true', () => {
      expect(jsonEqual(null, null)).toBe(true)
    })

    it('Given two different strings, When comparing, Then returns false', () => {
      expect(jsonEqual('abc', 'xyz')).toBe(false)
    })

    it('Given two different numbers, When comparing, Then returns false', () => {
      expect(jsonEqual(1, 2)).toBe(false)
    })

    it('Given two different booleans, When comparing, Then returns false', () => {
      expect(jsonEqual(true, false)).toBe(false)
    })
  })

  describe('null asymmetry', () => {
    it('Given a=null and b non-null, When comparing, Then returns false', () => {
      expect(jsonEqual(null, 'x')).toBe(false)
    })

    it('Given a non-null and b=null, When comparing, Then returns false', () => {
      expect(jsonEqual('x', null)).toBe(false)
    })

    it('Given a=null and b=object, When comparing, Then returns false', () => {
      expect(jsonEqual(null, {})).toBe(false)
    })

    it('Given a=object and b=null, When comparing, Then returns false', () => {
      expect(jsonEqual({}, null)).toBe(false)
    })
  })

  describe('type mismatch', () => {
    it('Given number vs string, When comparing, Then returns false', () => {
      expect(jsonEqual(1, '1')).toBe(false)
    })

    it('Given boolean vs number, When comparing, Then returns false', () => {
      expect(jsonEqual(true, 1)).toBe(false)
    })

    it('Given string vs object, When comparing, Then returns false', () => {
      expect(jsonEqual('a', {})).toBe(false)
    })

    it('Given object vs string, When comparing, Then returns false', () => {
      expect(jsonEqual({}, 'a')).toBe(false)
    })

    it('Given object vs array, When comparing, Then returns false', () => {
      expect(jsonEqual({}, [])).toBe(false)
    })

    it('Given array vs object, When comparing, Then returns false', () => {
      expect(jsonEqual([], {})).toBe(false)
    })
  })

  describe('arrays', () => {
    it('Given two empty arrays, When comparing, Then returns true', () => {
      expect(jsonEqual([], [])).toBe(true)
    })

    it('Given arrays with same elements in same order, When comparing, Then returns true', () => {
      expect(jsonEqual([1, 'a', true, null], [1, 'a', true, null])).toBe(true)
    })

    it('Given arrays of different lengths, When comparing, Then returns false', () => {
      expect(jsonEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('Given arrays with different element values, When comparing, Then returns false', () => {
      expect(jsonEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it('Given arrays with same elements in different order, When comparing, Then returns false', () => {
      expect(jsonEqual([1, 2, 3], [3, 2, 1])).toBe(false)
    })

    it('Given nested arrays, When comparing, Then compares recursively', () => {
      expect(jsonEqual([[1, 2], [3]], [[1, 2], [3]])).toBe(true)
      expect(jsonEqual([[1, 2], [3]], [[1, 2], [4]])).toBe(false)
    })
  })

  describe('objects', () => {
    it('Given two empty objects, When comparing, Then returns true', () => {
      expect(jsonEqual({}, {})).toBe(true)
    })

    it('Given objects with identical key-value pairs, When comparing, Then returns true', () => {
      expect(jsonEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true)
    })

    it('Given objects with same data in different key order, When comparing, Then returns true', () => {
      expect(jsonEqual({ a: 1, b: 2, c: 3 }, { c: 3, a: 1, b: 2 })).toBe(true)
    })

    it('Given objects with different values, When comparing, Then returns false', () => {
      expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('Given objects with different keys but same count, When comparing, Then returns false', () => {
      expect(jsonEqual({ a: 1 }, { b: 1 })).toBe(false)
    })

    it('Given objects with different key counts, When comparing, Then returns false', () => {
      expect(jsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('Given nested objects, When comparing, Then compares recursively', () => {
      const a: JsonValue = { outer: { inner: [1, 2], tag: 'x' } }
      const b: JsonValue = { outer: { inner: [1, 2], tag: 'x' } }
      const c: JsonValue = { outer: { inner: [1, 3], tag: 'x' } }
      expect(jsonEqual(a, b)).toBe(true)
      expect(jsonEqual(a, c)).toBe(false)
    })
  })
})
