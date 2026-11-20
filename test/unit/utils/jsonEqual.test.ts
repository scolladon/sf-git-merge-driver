import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../src/types/jsonTypes.js'
import {
  jsonEqual,
  jsonIdentical,
  jsonIdenticalUpToAttributeOrder,
} from '../../../src/utils/jsonEqual.js'

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

    it('Given undefined vs object, When comparing, Then returns false (kills || vs && mutant)', () => {
      expect(jsonEqual(undefined as unknown, {})).toBe(false)
    })

    it('Given object vs undefined, When comparing, Then returns false', () => {
      expect(jsonEqual({}, undefined as unknown)).toBe(false)
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

describe('jsonIdentical', () => {
  describe('given objects holding the same keys in a different order', () => {
    it('should be false where jsonEqual is true', () => {
      // Arrange
      const left = { outer: { a: '1', b: '2' } }
      const right = { outer: { b: '2', a: '1' } }

      // Act
      const sut = jsonIdentical(left, right)

      // Assert
      expect(sut).toBe(false)
      expect(jsonEqual(left, right)).toBe(true)
    })
  })

  describe('given objects holding the same keys in the same order', () => {
    it('should be true', () => {
      // Act
      const sut = jsonIdentical(
        { a: ['1', { b: '2' }] },
        { a: ['1', { b: '2' }] }
      )

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('given objects holding different keys', () => {
    it('should be false', () => {
      // Act
      const sut = jsonIdentical({ a: '1' }, { b: '1' })

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given objects of different sizes', () => {
    it('should be false', () => {
      // Act
      const sut = jsonIdentical({ a: '1' }, { a: '1', b: '2' })

      // Assert
      expect(sut).toBe(false)
    })
  })
})

describe('jsonIdenticalUpToAttributeOrder', () => {
  describe.each([
    [
      'attributes listed in another order',
      { '@_a': '1', '@_b': '2', child: 'x' },
      { '@_b': '2', '@_a': '1', child: 'x' },
      true,
    ],
    [
      'attributes reordered below a child tag',
      { child: { '@_a': '1', '@_b': '2' } },
      { child: { '@_b': '2', '@_a': '1' } },
      true,
    ],
    [
      'attributes interleaved with child tags',
      { '@_a': '1', first: 'x', '@_b': '2', second: 'y' },
      { first: 'x', '@_b': '2', '@_a': '1', second: 'y' },
      true,
    ],
    [
      'child tags listed in another order',
      { first: 'x', second: 'y' },
      { second: 'y', first: 'x' },
      false,
    ],
    ['an attribute value that differs', { '@_a': '1' }, { '@_a': '2' }, false],
    [
      'a different attribute',
      { '@_a': '1', child: 'x' },
      { '@_b': '1', child: 'x' },
      false,
    ],
    [
      'a different number of keys',
      { '@_a': '1' },
      { '@_a': '1', '@_b': '2' },
      false,
    ],
  ])('given %s', (_, left, right, expected) => {
    it(`should be ${expected}`, () => {
      // Act
      const sut = jsonIdenticalUpToAttributeOrder(left, right)

      // Assert
      expect(sut).toBe(expected)
    })
  })

  describe('objects with as many keys but other names', () => {
    it('Given keys that hold no value, When comparing, Then returns false', () => {
      // Arrange
      const left = { a: undefined } as unknown as JsonValue
      const right = { b: undefined } as unknown as JsonValue

      // Act
      const sut = [jsonEqual(left, right), jsonIdentical(left, right)]

      // Assert
      expect(sut).toEqual([false, false])
    })
  })
})
