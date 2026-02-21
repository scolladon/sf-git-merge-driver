import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import {
  buildKeyedMap,
  ensureArray,
  filterEmptyTextNodes,
  generateObj,
  getUniqueSortedProps,
  toJsonArray,
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

    it('given value when generateObj then returns wrapped object', () => {
      // Arrange
      // Act
      const result = generateObj('value', 'attr')

      // Assert
      expect(result).toEqual({ attr: [{ '#text': 'value' }] })
    })
  })

  describe('toJsonArray', () => {
    it('given simple object when toJsonArray then returns array with wrapped values', () => {
      // Arrange
      const obj = { attr: 'value' }

      // Act
      const result = toJsonArray(obj)

      // Assert
      expect(result).toEqual([{ attr: [{ '#text': 'value' }] }])
    })

    it('given empty object when toJsonArray then returns empty array', () => {
      // Arrange
      // Act
      const result = toJsonArray({})

      // Assert
      expect(result).toEqual([])
    })

    it('given nested object when toJsonArray then returns flattened array', () => {
      // Arrange
      const obj = { outer: [{ inner: 'value' }] }

      // Act
      const result = toJsonArray(obj)

      // Assert
      expect(result.length).toBeGreaterThan(0)
    })

    it('given object with array containing primitive values when toJsonArray then generates objects for primitives', () => {
      // Arrange - covers the else branch in line 41 where value is NOT an object
      const obj = { items: ['a', 'b', 'c'] }

      // Act
      const result = toJsonArray(obj)

      // Assert
      expect(result).toEqual([
        { items: [{ '#text': 'a' }] },
        { items: [{ '#text': 'b' }] },
        { items: [{ '#text': 'c' }] },
      ])
    })

    it('given object with array containing mixed primitives and objects when toJsonArray then handles both', () => {
      // Arrange - covers both branches in line 41
      const obj = {
        items: ['primitive', { nested: 'object' }],
      }

      // Act
      const result = toJsonArray(obj)

      // Assert
      expect(result.length).toBe(2)
      // First element is primitive wrapped
      expect(result[0]).toEqual({ items: [{ '#text': 'primitive' }] })
      // Second element is nested object processed recursively
      expect(result[1]).toHaveProperty('items')
    })

    it('given object with null value in array when toJsonArray then generates empty object', () => {
      // Arrange - covers the isNil branch in generateObj within toJsonArray
      const obj = { items: [null, 'valid'] }

      // Act
      const result = toJsonArray(obj)

      // Assert
      // null generates empty object {}, 'valid' generates wrapped object
      expect(result).toContainEqual({ items: [{ '#text': 'valid' }] })
    })
  })

  describe('filterEmptyTextNodes', () => {
    it('Given array with empty text node, When filtering, Then removes it', () => {
      // Arrange
      const markers = [{ [TEXT_TAG]: '  ' }, { field: 'value' }]

      // Act
      const result = filterEmptyTextNodes(markers)

      // Assert
      expect(result).toEqual([{ field: 'value' }])
    })

    it('Given array with non-empty text node, When filtering, Then keeps it', () => {
      // Arrange
      const markers = [{ [TEXT_TAG]: 'content' }, { field: 'value' }]

      // Act
      const result = filterEmptyTextNodes(markers)

      // Assert
      expect(result).toEqual([{ [TEXT_TAG]: 'content' }, { field: 'value' }])
    })

    it('Given array without text nodes, When filtering, Then returns unchanged', () => {
      // Arrange
      const markers = [{ field: 'a' }, { field: 'b' }]

      // Act
      const result = filterEmptyTextNodes(markers)

      // Assert
      expect(result).toEqual([{ field: 'a' }, { field: 'b' }])
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
