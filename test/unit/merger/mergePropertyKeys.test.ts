import { describe, expect, it } from 'vitest'
import { getUniqueProps } from '../../../src/merger/mergePropertyKeys.js'

describe('mergePropertyKeys', () => {
  describe('getUniqueProps', () => {
    it('given multiple objects and arrays when getUniqueProps then returns unique keys in first-seen order', () => {
      // Arrange
      const a = { b: 1, a: 2 }
      const b = { c: 3, a: 4 }
      const c = ['x', 'y'] // keys: '0','1'
      const d = null
      const e = undefined

      // Act
      const sut = getUniqueProps(
        a as never,
        b as never,
        c as never,
        d as never,
        e as never
      )

      // Assert
      expect(sut).toEqual(['b', 'a', 'c', '0', '1'])
    })

    it('given empty objects when getUniqueProps then returns empty array', () => {
      // Arrange & Act
      const sut = getUniqueProps({}, {}, {})

      // Assert
      expect(sut).toEqual([])
    })

    it('given single object when getUniqueProps then returns keys in first-seen order', () => {
      // Arrange
      const obj = { z: 1, a: 2, m: 3 }

      // Act
      const sut = getUniqueProps(obj)

      // Assert
      expect(sut).toEqual(['z', 'a', 'm'])
    })

    it('given objects with duplicate keys when getUniqueProps then dedups preserving first-seen order', () => {
      // Arrange
      const a = { x: 1, y: 2 }
      const b = { x: 3, z: 4 }

      // Act
      const sut = getUniqueProps(a, b)

      // Assert
      expect(sut).toEqual(['x', 'y', 'z'])
    })

    it('given objects whose first-seen order is non-alphabetical when getUniqueProps then preserves first-seen across objects with dedup', () => {
      // Arrange
      const a = { b: 1, a: 2 }
      const b = { c: 3, a: 4 }

      // Act
      const sut = getUniqueProps(a, b)

      // Assert
      expect(sut).toEqual(['b', 'a', 'c'])
    })
  })
})
