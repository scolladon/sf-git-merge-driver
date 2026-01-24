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

    it('should handle duplicate values in ancestor array', () => {
      // Arrange - covers seen.has(item) branch for duplicates in ancestor
      const ancestor = ['a', 'a', 'b']
      const local = ['a', 'b']
      const other = ['a', 'b']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(2) // a, b (deduplicated)
    })

    it('should handle duplicate values in local array', () => {
      // Arrange - covers seen.has(item) branch for duplicates in local
      const ancestor: string[] = []
      const local = ['a', 'a', 'b']
      const other = ['c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(3) // a, b, c (deduplicated)
    })

    it('should handle duplicate values in other array', () => {
      // Arrange - covers seen.has(item) branch for duplicates in other
      const ancestor: string[] = []
      const local = ['a']
      const other = ['b', 'b', 'c']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(3) // a, b, c (deduplicated)
    })

    it('should correctly sort equal values', () => {
      // Arrange - covers the equality case (return 0) in compareItems
      const ancestor: string[] = []
      const local = ['same', 'same']
      const other = ['same']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toHaveLength(1) // deduplicated to single 'same'
    })

    it('should sort items in ascending order', () => {
      // Arrange - covers strA < strB returning -1 in compareItems
      const ancestor: string[] = []
      const local = ['z', 'a']
      const other: string[] = []
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.output[0]).toEqual({ items: [{ [TEXT_TAG]: 'a' }] })
      expect(result.output[1]).toEqual({ items: [{ [TEXT_TAG]: 'z' }] })
    })

    it('should correctly compare items where first is greater', () => {
      // Arrange - explicitly covers strA > strB returning 1 in compareItems
      const ancestor: string[] = []
      const local = ['b']
      const other = ['a']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // After sort: a, b
      expect(result.output[0]).toEqual({ items: [{ [TEXT_TAG]: 'a' }] })
      expect(result.output[1]).toEqual({ items: [{ [TEXT_TAG]: 'b' }] })
    })

    it('should skip adding item from local when it exists in ancestor', () => {
      // Arrange - covers !ancestorSet.has(item) being false in local loop (line 53)
      const ancestor = ['a', 'b']
      const local = ['a', 'b', 'c'] // 'a' and 'b' are in ancestor, 'c' is new
      const other = ['a', 'b']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // 'a' and 'b' kept from ancestor loop (in both local/other)
      // 'c' added from local (not in ancestor)
      expect(result.output).toHaveLength(3)
    })

    it('should skip adding item from other when it exists in ancestor', () => {
      // Arrange - covers !ancestorSet.has(item) being false in other loop (line 62)
      const ancestor = ['a', 'b']
      const local = ['a', 'b']
      const other = ['a', 'b', 'd'] // 'a' and 'b' are in ancestor, 'd' is new
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // 'a' and 'b' kept from ancestor loop (in both local/other)
      // 'd' added from other (not in ancestor)
      expect(result.output).toHaveLength(3)
    })

    it('should skip items from local already seen in ancestor', () => {
      // Arrange - item appears in both ancestor and local, should only process once
      const ancestor = ['x']
      const local = ['x', 'y']
      const other = ['x']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // 'x' processed in ancestor loop (kept because in both local/other)
      // 'x' skipped in local loop (already seen)
      // 'y' added in local loop (new, not in ancestor)
      expect(result.output).toHaveLength(2)
    })

    it('should skip items from other already seen in ancestor or local', () => {
      // Arrange - item appears in ancestor/local and other, should only process once
      const ancestor = ['m']
      const local = ['m', 'n']
      const other = ['m', 'n', 'o']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // 'm' processed in ancestor loop
      // 'n' processed in local loop
      // 'm' and 'n' skipped in other loop (already seen)
      // 'o' added in other loop
      expect(result.output).toHaveLength(3)
    })

    it('should handle items with same string representation', () => {
      // Arrange - number 1 and string '1' both stringify to '1', covers return 0 branch
      const ancestor: (string | number)[] = []
      const local: (string | number)[] = [1]
      const other: (string | number)[] = ['1']
      const node = new TextArrayMergeNode(ancestor, local, other, 'items')

      // Act
      const result = node.merge(defaultConfig)

      // Assert - both added since they're different values (different references)
      expect(result.output).toHaveLength(2)
    })
  })
})
