import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { TextArrayMergeNode } from '../../../../src/merger/nodes/TextArrayMergeNode.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('TextArrayMergeNode', () => {
  describe('merge', () => {
    it('should merge identical arrays without conflict', () => {
      // Arrange
      const ancestor = ['a', 'b', 'c']
      const local = ['a', 'b', 'c']
      const other = ['a', 'b', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        { items: [{ [TEXT_TAG]: 'a' }] },
        { items: [{ [TEXT_TAG]: 'b' }] },
        { items: [{ [TEXT_TAG]: 'c' }] },
      ])
    })

    it('should add new elements from local', () => {
      // Arrange
      const ancestor = ['a', 'b']
      const local = ['a', 'b', 'c']
      const other = ['a', 'b']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(3)
    })

    it('should add new elements from other', () => {
      // Arrange
      const ancestor = ['a', 'b']
      const local = ['a', 'b']
      const other = ['a', 'b', 'd']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(3)
    })

    it('should add new elements from both local and other', () => {
      // Arrange
      const ancestor = ['a']
      const local = ['a', 'b']
      const other = ['a', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(3) // a, b, c
    })

    it('should remove elements deleted in local', () => {
      // Arrange
      const ancestor = ['a', 'b', 'c']
      const local = ['a', 'c']
      const other = ['a', 'b', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(2) // a, c (b removed)
    })

    it('should remove elements deleted in other', () => {
      // Arrange
      const ancestor = ['a', 'b', 'c']
      const local = ['a', 'b', 'c']
      const other = ['a', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(2) // a, c (b removed)
    })

    it('should remove elements deleted in both', () => {
      // Arrange
      const ancestor = ['a', 'b', 'c']
      const local = ['a', 'c']
      const other = ['a', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(2) // a, c
    })

    it('should sort results alphabetically', () => {
      // Arrange
      const ancestor: string[] = []
      const local = ['c', 'a']
      const other = ['b']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        { items: [{ [TEXT_TAG]: 'a' }] },
        { items: [{ [TEXT_TAG]: 'b' }] },
        { items: [{ [TEXT_TAG]: 'c' }] },
      ])
    })

    it('should return empty array when all elements are removed', () => {
      // Arrange
      const ancestor = ['a', 'b']
      const local: string[] = []
      const other: string[] = []
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should handle empty arrays', () => {
      // Arrange
      const ancestor: string[] = []
      const local: string[] = []
      const other: string[] = []
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should deduplicate elements', () => {
      // Arrange
      const ancestor = ['a']
      const local = ['a', 'a']
      const other = ['a']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(1)
    })

    it('should handle arrays with null values added by both sides', () => {
      // Arrange - covers isNil branch in generateObj (null not removed, passed to generateObj)
      const ancestor = ['a']
      const local = ['a', null as unknown as string]
      const other = ['a', null as unknown as string]
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      // null value generates empty object {} which is included in output
      expect(result.output).toContainEqual({})
      expect(result.output).toContainEqual({ items: [{ [TEXT_TAG]: 'a' }] })
    })

    it('should handle arrays with undefined values added by both sides', () => {
      // Arrange - covers isNil branch in generateObj (undefined not removed, passed to generateObj)
      const ancestor = ['b']
      const local = ['b', undefined as unknown as string]
      const other = ['b', undefined as unknown as string]
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      // undefined value generates empty object {} which is included in output
      expect(result.output).toContainEqual({})
    })
  })
})
