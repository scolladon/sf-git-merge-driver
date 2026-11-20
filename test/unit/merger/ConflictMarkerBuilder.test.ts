import { describe, expect, it } from 'vitest'
import { buildConflictMarkers } from '../../../src/merger/ConflictMarkerBuilder.js'
import type { ConflictBlock } from '../../../src/types/conflictBlock.js'

describe('ConflictMarkerBuilder', () => {
  describe('buildConflictMarkers', () => {
    it('should build conflict block with all values present', () => {
      // Arrange
      const local = { field: 'localValue' }
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.local).toEqual([local])
      expect(sut.ancestor).toEqual([ancestor])
      expect(sut.other).toEqual([other])
    })

    it('given an empty local when building then the local side is an empty list', () => {
      // Arrange
      const local = {}
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.local).toEqual([])
    })

    it('given an empty ancestor when building then the ancestor side is an empty list', () => {
      // Arrange
      const local = { field: 'localValue' }
      const ancestor = {}
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.ancestor).toEqual([])
    })

    it('given an empty other when building then the other side is an empty list', () => {
      // Arrange
      const local = { field: 'localValue' }
      const ancestor = { field: 'ancestorValue' }
      const other = {}

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.other).toEqual([])
    })

    it('should handle arrays as values', () => {
      // Arrange
      const local = [{ field: 'localValue' }]
      const ancestor = [{ field: 'ancestorValue' }]
      const other = [{ field: 'otherValue' }]

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.local).toEqual(local)
      expect(sut.ancestor).toEqual(ancestor)
      expect(sut.other).toEqual(other)
    })

    it('given an empty array when building then that side is an empty list', () => {
      // Arrange
      const local: never[] = []
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.local).toEqual([])
    })

    it('given non-empty array when building then keeps array as-is', () => {
      // Arrange
      const local = [{ a: 1 }]
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.local).toEqual([{ a: 1 }])
    })

    it('given non-empty object when building then keeps object as-is', () => {
      // Arrange
      const local = { a: 1 }
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.local).toEqual([{ a: 1 }])
    })

    it('given a null side when building then the side is an empty list', () => {
      // Act
      const sut: ConflictBlock = buildConflictMarkers(null, { a: '1' }, 'text')

      // Assert
      expect(sut.local).toEqual([])
      expect(sut.other).toEqual(['text'])
    })

    it('given scalars without properties when building then each is kept as a side', () => {
      // Act
      const sut: ConflictBlock = buildConflictMarkers('', 0, false)

      // Assert
      expect(sut.local).toEqual([''])
      expect(sut.ancestor).toEqual([0])
      expect(sut.other).toEqual([false])
    })
  })
})
