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

    it('should use empty object when local is empty', () => {
      // Arrange
      const local = {}
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.local).toEqual([{}])
    })

    it('should use empty object when ancestor is empty', () => {
      // Arrange
      const local = { field: 'localValue' }
      const ancestor = {}
      const other = { field: 'otherValue' }

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.ancestor).toEqual([{}])
    })

    it('should use empty object when other is empty', () => {
      // Arrange
      const local = { field: 'localValue' }
      const ancestor = { field: 'ancestorValue' }
      const other = {}

      // Act
      const sut: ConflictBlock = buildConflictMarkers(local, ancestor, other)

      // Assert
      expect(sut.__conflict).toBe(true)
      expect(sut.other).toEqual([{}])
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
  })
})
