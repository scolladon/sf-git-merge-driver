import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { PropertyMergeNode } from '../../../../src/merger/nodes/PropertyMergeNode.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('PropertyMergeNode', () => {
  it('should merge objects and wrap results with attribute key', () => {
    // Arrange
    const ancestor = { prop: { field: 'ancestorValue' } }
    const local = { prop: { field: 'localValue' } }
    const other = { prop: { field: 'otherValue' } }
    const node = new PropertyMergeNode(ancestor, local, other, 'container')

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
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

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
    const node = new PropertyMergeNode(ancestor, local, other, 'container')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
  })

  it('should omit container when all children resolve to nothing', () => {
    // Arrange
    const node = new PropertyMergeNode({}, {}, {}, 'container')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([])
  })

  it('should merge multiple properties simultaneously', () => {
    // Arrange
    const ancestor = { a: 'original', b: 'original' }
    const local = { a: 'localA', b: 'localB' }
    const other = { a: 'original', b: 'original' }
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([
      {
        wrapper: [
          { a: [{ [TEXT_TAG]: 'localA' }] },
          { b: [{ [TEXT_TAG]: 'localB' }] },
        ],
      },
    ])
  })

  it('should include property only in local', () => {
    // Arrange
    const ancestor = {}
    const local = { added: 'newValue' }
    const other = {}
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([
      { wrapper: [{ added: [{ [TEXT_TAG]: 'newValue' }] }] },
    ])
  })

  it('should include property only in other', () => {
    // Arrange
    const ancestor = {}
    const local = {}
    const other = { added: 'otherValue' }
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([
      { wrapper: [{ added: [{ [TEXT_TAG]: 'otherValue' }] }] },
    ])
  })

  it('should return empty when property deleted in both', () => {
    // Arrange
    const ancestor = { removed: 'value' }
    const local = {}
    const other = {}
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([])
  })

  it('should propagate hasConflict from mixed children', () => {
    // Arrange
    const ancestor = { safe: 'original', conflict: 'original' }
    const local = { safe: 'localSafe', conflict: 'localConflict' }
    const other = { safe: 'original', conflict: 'otherConflict' }
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(true)
    expect(result.output.length).toBe(1)
    expect(result.output[0]).toHaveProperty('wrapper')
  })

  it('should handle nested objects recursively', () => {
    // Arrange
    const ancestor = { nested: { inner: 'original' } }
    const local = { nested: { inner: 'changed' } }
    const other = { nested: { inner: 'original' } }
    const node = new PropertyMergeNode(ancestor, local, other, 'wrapper')

    // Act
    const result = node.merge(defaultConfig)

    // Assert
    expect(result.hasConflict).toBe(false)
    expect(result.output).toEqual([
      {
        wrapper: [{ nested: [{ inner: [{ [TEXT_TAG]: 'changed' }] }] }],
      },
    ])
  })
})
