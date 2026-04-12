import { describe, expect, it } from 'vitest'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { buildKeyedMap } from '../../../../src/merger/nodes/KeyedArrayIndex.js'

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
})
