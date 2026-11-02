import { describe, expect, it } from 'vitest'
import { takeFirst } from '../../../src/utils/iteratorUtils.js'

describe('iteratorUtils', () => {
  describe('takeFirst', () => {
    describe('given an iterator with items', () => {
      it('should return the first item and leave the rest', () => {
        // Arrange
        const sut = [1, 2, 3][Symbol.iterator]()

        // Act
        const result = takeFirst(sut)

        // Assert
        expect(result).toBe(1)
        expect([...{ [Symbol.iterator]: () => sut }]).toEqual([2, 3])
      })
    })

    describe('given an exhausted iterator', () => {
      it('should throw', () => {
        // Arrange
        const sut = [][Symbol.iterator]()

        // Act
        const act = () => takeFirst(sut)

        // Assert
        expect(act).toThrow('at least one item')
      })
    })
  })
})
