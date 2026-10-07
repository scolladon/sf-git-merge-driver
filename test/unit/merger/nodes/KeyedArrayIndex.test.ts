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
      ['no key', undefined, 'undefined'],
      ['a key', 'k', 'k'],
      ['an empty key', '', ''],
    ])(
      'given an extractor returning %s when indexing then returns %s',
      (_, key, expected) => {
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

    it.each([
      ['no keyless entry', [[keyed], [keyed], [keyed]], false],
      ['one keyless entry on one side', [[keyless], [keyed], [keyed]], false],
      [
        'one keyless entry on each side',
        [[keyless], [keyless], [keyless]],
        false,
      ],
      ['two keyless entries on local', [[], [keyless, keyless], []], true],
      [
        'two keyless entries on ancestor only',
        [[keyless, keyless], [], []],
        true,
      ],
      ['two keyless entries on other only', [[], [], [keyless, keyless]], true],
      [
        'three keyless entries on one side',
        [[], [], [keyless, keyless, keyless]],
        true,
      ],
      ['non-object entries', [[], ['x', 'y'], []], true],
    ])('given %s when checking then returns %s', (_, sides, expected) => {
      // Arrange
      const arrays = sides as unknown as JsonArray[]

      // Act
      const result = hasKeylessCollision(arrays, keyOf)

      // Assert
      expect(result).toBe(expected)
    })

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
