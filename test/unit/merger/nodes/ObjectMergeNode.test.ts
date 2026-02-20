import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import {
  NestedObjectMergeNode,
  ObjectMergeNode,
} from '../../../../src/merger/nodes/ObjectMergeNode.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('NestedObjectMergeNode', () => {
  describe('scenario handling', () => {
    it('should return empty for NONE scenario (all empty)', () => {
      // Arrange
      const node = new NestedObjectMergeNode({}, {}, {})

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should return empty for ANCESTOR_ONLY scenario', () => {
      // Arrange
      const ancestor = { field: 'value' }
      const node = new NestedObjectMergeNode(ancestor, {}, {})

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should return local content for LOCAL_ONLY scenario', () => {
      // Arrange
      const local = { field: 'value' }
      const node = new NestedObjectMergeNode({}, local, {})

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should return other content for OTHER_ONLY scenario', () => {
      // Arrange
      const other = { field: 'value' }
      const node = new NestedObjectMergeNode({}, {}, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should return other content for LOCAL_AND_OTHER when equal', () => {
      // Arrange
      const local = { field: 'value' }
      const other = { field: 'value' }
      const node = new NestedObjectMergeNode({}, local, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should merge children for LOCAL_AND_OTHER when different', () => {
      // Arrange
      const local = { field: 'localValue' }
      const other = { field: 'otherValue' }
      const node = new NestedObjectMergeNode({}, local, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should return empty for ANCESTOR_AND_OTHER when equal', () => {
      // Arrange
      const ancestor = { field: 'value' }
      const other = { field: 'value' }
      const node = new NestedObjectMergeNode(ancestor, {}, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should create conflict for ANCESTOR_AND_OTHER when different', () => {
      // Arrange
      const ancestor = { field: 'ancestorValue' }
      const other = { field: 'otherValue' }
      const node = new NestedObjectMergeNode(ancestor, {}, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
      // Should contain conflict markers
      const output = result.output as Array<Record<string, unknown>>
      const hasLocalMarker = output.some(
        item =>
          typeof item === 'object' &&
          String(item[TEXT_TAG] ?? '').includes('ours')
      )
      expect(hasLocalMarker).toBe(true)
    })

    it('should return empty for ANCESTOR_AND_LOCAL when equal', () => {
      // Arrange
      const ancestor = { field: 'value' }
      const local = { field: 'value' }
      const node = new NestedObjectMergeNode(ancestor, local, {})

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should create conflict for ANCESTOR_AND_LOCAL when different', () => {
      // Arrange
      const ancestor = { field: 'ancestorValue' }
      const local = { field: 'localValue' }
      const node = new NestedObjectMergeNode(ancestor, local, {})

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should merge children for ALL scenario', () => {
      // Arrange
      const ancestor = { field: 'ancestorValue' }
      const local = { field: 'localValue' }
      const other = { field: 'otherValue' }
      const node = new NestedObjectMergeNode(ancestor, local, other)

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('mergeWithContext', () => {
    it('should merge using provided context', () => {
      // Arrange
      const ancestor = { field: 'ancestorValue' }
      const local = { field: 'localValue' }
      const other = { field: 'otherValue' }
      const node = new NestedObjectMergeNode(ancestor, local, other)
      const context: MergeContext = {
        config: defaultConfig,
        ancestor,
        local,
        other,
        attribute: undefined,
        nodeFactory: defaultNodeFactory,
        rootKey: undefined,
      }

      // Act
      const result = node.mergeWithContext(context)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should use context nodeFactory for merging', () => {
      // Arrange
      const ancestor = { field: 'value' }
      const local = { field: 'value' }
      const other = { field: 'value' }
      const node = new NestedObjectMergeNode(ancestor, local, other)
      const context: MergeContext = {
        config: defaultConfig,
        ancestor,
        local,
        other,
        attribute: undefined,
        nodeFactory: defaultNodeFactory,
        rootKey: undefined,
      }

      // Act
      const result = node.mergeWithContext(context)

      // Assert
      expect(result.hasConflict).toBe(false)
    })
  })
})

describe('ObjectMergeNode', () => {
  it('should merge objects and wrap results with attribute key', () => {
    // Arrange
    const ancestor = { prop: { field: 'ancestorValue' } }
    const local = { prop: { field: 'localValue' } }
    const other = { prop: { field: 'otherValue' } }
    const node = new ObjectMergeNode(ancestor, local, other, 'container')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(true)
    expect(result.output.length).toBe(1)
    expect(result.output[0]).toHaveProperty('container')
  })

  it('should not double-wrap child output with property key', () => {
    // Arrange
    const ancestor = { field: 'ancestorValue' }
    const local = { field: 'localValue' }
    const other = { field: 'ancestorValue' }
    const node = new ObjectMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([
      { wrapper: [{ field: [{ [TEXT_TAG]: 'localValue' }] }] },
    ])
  })

  it('should handle string arrays', () => {
    // Arrange
    const ancestor = { items: ['a', 'b'] }
    const local = { items: ['a', 'b', 'c'] }
    const other = { items: ['a', 'b'] }
    const node = new ObjectMergeNode(ancestor, local, other, 'container')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
  })

  it('should omit container when all children resolve to nothing', () => {
    // Arrange
    const node = new ObjectMergeNode({}, {}, {}, 'container')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([])
  })
})
