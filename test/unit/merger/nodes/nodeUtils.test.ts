import { describe, expect, it } from 'vitest'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import {
  buildKeyedMap,
  ensureArray,
  generateObj,
  getUniqueSortedProps,
} from '../../../../src/merger/nodes/nodeUtils.js'

describe('nodeUtils', () => {
  describe('ensureArray', () => {
    it('given undefined when ensureArray then returns empty array', () => {
      // Arrange
      // Act
      const result = ensureArray(undefined as unknown as never)

      // Assert
      expect(result).toEqual([])
    })

    it('given null when ensureArray then returns empty array', () => {
      // Arrange
      // Act
      const result = ensureArray(null as unknown as never)

      // Assert
      expect(result).toEqual([])
    })

    it('given primitive when ensureArray then wraps into array', () => {
      // Arrange
      // Act
      const result = ensureArray('x' as unknown as never)

      // Assert
      expect(result).toEqual(['x'])
    })

    it('given array when ensureArray then returns same values', () => {
      // Arrange
      const arr = [1, 2]

      // Act
      const result = ensureArray(arr as unknown as never)

      // Assert
      expect(result).toEqual([1, 2])
    })
  })

  describe('getUniqueSortedProps', () => {
    it('given multiple objects and arrays when getUniqueSortedProps then returns unique sorted keys', () => {
      // Arrange
      const a = { b: 1, a: 2 }
      const b = { c: 3, a: 4 }
      const c = ['x', 'y'] // keys: '0','1'
      const d = null
      const e = undefined

      // Act
      const result = getUniqueSortedProps(
        a as never,
        b as never,
        c as never,
        d as never,
        e as never
      )

      // Assert
      expect(result).toEqual(['0', '1', 'a', 'b', 'c'])
    })

    it('given empty objects when getUniqueSortedProps then returns empty array', () => {
      // Arrange
      // Act
      const result = getUniqueSortedProps({}, {}, {})

      // Assert
      expect(result).toEqual([])
    })

    it('given single object when getUniqueSortedProps then returns sorted keys', () => {
      // Arrange
      const obj = { z: 1, a: 2, m: 3 }

      // Act
      const result = getUniqueSortedProps(obj)

      // Assert
      expect(result).toEqual(['a', 'm', 'z'])
    })

    it('given objects with duplicate keys when getUniqueSortedProps then returns unique keys', () => {
      // Arrange
      const a = { x: 1, y: 2 }
      const b = { x: 3, z: 4 }

      // Act
      const result = getUniqueSortedProps(a, b)

      // Assert
      expect(result).toEqual(['x', 'y', 'z'])
    })
  })

  describe('generateObj', () => {
    it('given null value when generateObj then returns empty object', () => {
      // Arrange
      // Act
      const result = generateObj(null, 'attr')

      // Assert
      expect(result).toEqual({})
    })

    it('given value when generateObj then returns compact object', () => {
      // Arrange
      // Act
      const result = generateObj('value', 'attr')

      // Assert
      expect(result).toEqual({ attr: 'value' })
    })
  })

  describe('buildKeyedMap', () => {
    it('Given array of objects, When building map, Then keys by extractor', () => {
      // Arrange
      const arr = [
        { name: [{ [TEXT_TAG]: 'a' }], value: 'x' },
        { name: [{ [TEXT_TAG]: 'b' }], value: 'y' },
      ]
      const keyField = (item: Record<string, unknown>) =>
        String((item['name'] as Array<Record<string, unknown>>)[0][TEXT_TAG])

      // Act
      const result = buildKeyedMap(arr, keyField)

      // Assert
      expect(result.size).toBe(2)
      expect(result.get('a')).toBe(arr[0])
      expect(result.get('b')).toBe(arr[1])
    })

    it('Given empty array, When building map, Then returns empty map', () => {
      // Arrange & Act
      const result = buildKeyedMap([], () => '')

      // Assert
      expect(result.size).toBe(0)
    })
  })
})
