import { describe, expect, it } from 'vitest'
import {
  buildConflictBlock,
  isConflictBlock,
} from '../../../src/types/conflictBlock.js'

describe('conflictBlock', () => {
  describe('isConflictBlock', () => {
    it('given a valid ConflictBlock when checking then returns true', () => {
      // Arrange
      const sut = buildConflictBlock({ a: '1' }, { a: '2' }, { a: '3' })

      // Act & Assert
      expect(isConflictBlock(sut)).toBe(true)
    })

    it('given a string when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock('not a block')).toBe(false)
    })

    it('given null when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock(null)).toBe(false)
    })

    it('given an array when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock([1, 2, 3])).toBe(false)
    })

    it('given an object without __conflict when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock({ local: [], ancestor: [], other: [] })).toBe(
        false
      )
    })

    it('given an object with __conflict set to false when checking then returns false', () => {
      // Act & Assert
      expect(
        isConflictBlock({
          __conflict: false,
          local: [],
          ancestor: [],
          other: [],
        })
      ).toBe(false)
    })

    it('given a number when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock(42)).toBe(false)
    })

    it('given a boolean when checking then returns false', () => {
      // Act & Assert
      expect(isConflictBlock(true)).toBe(false)
    })
  })

  describe('buildConflictBlock', () => {
    it('given objects when building then wraps each in an array', () => {
      // Arrange
      const local = { key: 'local' }
      const ancestor = { key: 'ancestor' }
      const other = { key: 'other' }

      // Act
      const sut = buildConflictBlock(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.local).toEqual([local])
      expect(sut.ancestor).toEqual([ancestor])
      expect(sut.other).toEqual([other])
    })

    it('given arrays when building then keeps them as arrays', () => {
      // Arrange
      const local = [{ a: '1' }, { b: '2' }]
      const ancestor = [{ a: '3' }]
      const other = [{ a: '4' }, { b: '5' }, { c: '6' }]

      // Act
      const sut = buildConflictBlock(local, ancestor, other)

      // Assert
      expect(sut.local).toBe(local)
      expect(sut.ancestor).toBe(ancestor)
      expect(sut.other).toBe(other)
    })

    it('given empty objects when building then wraps in single-element arrays', () => {
      // Act
      const sut = buildConflictBlock({}, {}, {})

      // Assert
      expect(sut.local).toEqual([{}])
      expect(sut.ancestor).toEqual([{}])
      expect(sut.other).toEqual([{}])
    })
  })
})
