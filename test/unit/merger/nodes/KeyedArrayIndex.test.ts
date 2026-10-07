import { describe, expect, it, vi } from 'vitest'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import {
  buildKeyedMap,
  hasKeylessCollision,
  toEntryKey,
} from '../../../../src/merger/nodes/KeyedArrayIndex.js'
import type { JsonArray } from '../../../../src/types/jsonTypes.js'

describe('KeyedArrayIndex', () => {
  describe('buildKeyedMap', () => {
    it('given array of objects when building map then keys by extractor', () => {
      // Arrange
      const arr = [
        { name: [{ [TEXT_TAG]: 'a' }], value: 'x' },
        { name: [{ [TEXT_TAG]: 'b' }], value: 'y' },
      ]
      const keyField = (item: Record<string, unknown>) =>
        String((item['name'] as Array<Record<string, unknown>>)[0][TEXT_TAG])

      // Act
      const sut = buildKeyedMap(arr, keyField)

      // Assert
      expect(sut.size).toBe(2)
      expect(sut.get('a')).toBe(arr[0])
      expect(sut.get('b')).toBe(arr[1])
    })

    it('given empty array when building map then returns empty map', () => {
      // Arrange & Act
      const sut = buildKeyedMap([], () => '')

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('toEntryKey', () => {
    it.each([
      { name: 'no key', key: undefined, expected: 'undefined' },
      { name: 'a key', key: 'k', expected: 'k' },
      { name: 'an empty key', key: '', expected: '' },
    ])(
      'given an extractor returning $name when indexing then returns "$expected"',
      ({ key, expected }) => {
        // Arrange
        const sut = toEntryKey(() => key)

        // Act
        const result = sut({})

        // Assert
        expect(result).toBe(expected)
      }
    )
  })

  describe('hasKeylessCollision', () => {
    const keyOf = (item: Record<string, unknown>) =>
      item['k'] as string | undefined
    const keyed = { k: 'a' }
    const keyless = { v: '1' }
    const keyedAsFallback = { k: 'undefined' }

    it.each([
      {
        name: 'no keyless entry',
        sides: [[keyed], [keyed], [keyed]],
        expected: false,
      },
      {
        name: 'one keyless entry on one side',
        sides: [[keyless], [keyed], [keyed]],
        expected: false,
      },
      {
        name: 'one keyless entry on each side',
        sides: [[keyless], [keyless], [keyless]],
        expected: false,
      },
      {
        name: 'two keyless entries on local',
        sides: [[], [keyless, keyless], []],
        expected: true,
      },
      {
        name: 'two keyless entries on ancestor only',
        sides: [[keyless, keyless], [], []],
        expected: true,
      },
      {
        name: 'two keyless entries on other only',
        sides: [[], [], [keyless, keyless]],
        expected: true,
      },
      {
        name: 'three keyless entries on one side',
        sides: [[], [], [keyless, keyless, keyless]],
        expected: true,
      },
      {
        name: 'non-object entries',
        sides: [[], ['x', 'y'], []],
        expected: true,
      },
      {
        name: 'a keyless entry beside a real key spelled like the fallback key',
        sides: [[], [keyedAsFallback, keyless], []],
        expected: true,
      },
      {
        name: 'a real key spelled like the fallback key beside a keyless entry',
        sides: [[], [keyless, keyedAsFallback], []],
        expected: true,
      },
      {
        name: 'a keyless entry and a real key spelled like the fallback key on different sides',
        sides: [[], [keyless], [keyedAsFallback]],
        expected: false,
      },
      {
        name: 'a real key spelled like the fallback key twice',
        sides: [[], [keyedAsFallback, keyedAsFallback], []],
        expected: false,
      },
    ])(
      'given $name when checking then returns $expected',
      ({ sides, expected }) => {
        // Arrange
        const arrays = sides as unknown as JsonArray[]

        // Act
        const result = hasKeylessCollision(arrays, keyOf)

        // Assert
        expect(result).toBe(expected)
      }
    )

    it('given a collision on the first side when checking then stops reading', () => {
      // Arrange
      const extractor = vi.fn(keyOf)

      // Act
      const result = hasKeylessCollision(
        [[keyless, keyless, keyless], [keyed], [keyed]],
        extractor
      )

      // Assert
      expect(result).toBe(true)
      expect(extractor).toHaveBeenCalledTimes(2)
    })
  })
})
