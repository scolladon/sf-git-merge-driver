import { describe, expect, it } from 'vitest'
import { getUniqueSortedProps } from '../../../src/merger/mergePropertyKeys.js'

describe('mergePropertyKeys', () => {
  describe('getUniqueSortedProps', () => {
    it('given multiple objects and arrays when getUniqueSortedProps then returns unique sorted keys', () => {
      // Arrange
      const a = { b: 1, a: 2 }
      const b = { c: 3, a: 4 }
      const c = ['x', 'y'] // keys: '0','1'
      const d = null
      const e = undefined

      // Act
      const sut = getUniqueSortedProps(
        a as never,
        b as never,
        c as never,
        d as never,
        e as never
      )

      // Assert
      expect(sut).toEqual(['0', '1', 'a', 'b', 'c'])
    })

    it('given empty objects when getUniqueSortedProps then returns empty array', () => {
      // Arrange & Act
      const sut = getUniqueSortedProps({}, {}, {})

      // Assert
      expect(sut).toEqual([])
    })

    it('given single object when getUniqueSortedProps then returns sorted keys', () => {
      // Arrange
      const obj = { z: 1, a: 2, m: 3 }

      // Act
      const sut = getUniqueSortedProps(obj)

      // Assert
      expect(sut).toEqual(['a', 'm', 'z'])
    })

    it('given objects with duplicate keys when getUniqueSortedProps then returns unique keys', () => {
      // Arrange
      const a = { x: 1, y: 2 }
      const b = { x: 3, z: 4 }

      // Act
      const sut = getUniqueSortedProps(a, b)

      // Assert
      expect(sut).toEqual(['x', 'y', 'z'])
    })
  })
})
