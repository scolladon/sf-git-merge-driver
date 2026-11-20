import { describe, expect, it } from 'vitest'
import { buildConflictMarkers } from '../../../../src/merger/ConflictMarkerBuilder.js'
import { PropertyMergeNode } from '../../../../src/merger/nodes/PropertyMergeNode.js'
import type { JsonObject } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

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
    expect(result.output).toEqual([{ wrapper: [{ field: 'localValue' }] }])
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
    const ancestor = { child: 'value' }
    const local = { child: null }
    const other = { child: null }
    const node = new PropertyMergeNode(ancestor, local, other, 'container')

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
        wrapper: [{ a: 'localA' }, { b: 'localB' }],
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
    expect(result.output).toEqual([{ wrapper: { added: 'newValue' } }])
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
    expect(result.output).toEqual([{ wrapper: { added: 'otherValue' } }])
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
        wrapper: [{ nested: [{ inner: 'changed' }] }],
      },
    ])
  })

  describe('given local deleted the element', () => {
    const ancestor = { label: 'x', type: 'Text' }

    describe('when other edited a child', () => {
      it('then one element block conflicts', () => {
        // Arrange
        const other = { label: 'y', type: 'Text' }
        const sut = new PropertyMergeNode(ancestor, {}, other, 'nameField')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({
          output: [
            buildConflictMarkers(
              [],
              [{ nameField: ancestor }],
              [{ nameField: other }]
            ),
          ],
          hasConflict: true,
        })
      })
    })

    describe('when other added a child', () => {
      it('then it conflicts', () => {
        // Arrange
        const other = { ...ancestor, trackHistory: 'true' }
        const sut = new PropertyMergeNode(ancestor, {}, other, 'nameField')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(result.output).toHaveLength(1)
      })
    })

    describe('when other left it unchanged', () => {
      it('then it stays deleted', () => {
        // Arrange
        const sut = new PropertyMergeNode(ancestor, {}, { ...ancestor }, 'f')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given other deleted the element', () => {
    describe('when local edited a child', () => {
      it('then one element block conflicts', () => {
        // Arrange
        const ancestor = { label: 'x', type: 'Text' }
        const local = { label: 'y', type: 'Text' }
        const sut = new PropertyMergeNode(ancestor, local, {}, 'nameField')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({
          output: [
            buildConflictMarkers(
              [{ nameField: local }],
              [{ nameField: ancestor }],
              []
            ),
          ],
          hasConflict: true,
        })
      })
    })
  })

  describe('given both sides added the element', () => {
    describe('when they gave different labels', () => {
      it('then the property-wise field block conflicts', () => {
        // Arrange
        const local = { label: 'a' }
        const other = { label: 'o' }
        const sut = new PropertyMergeNode({}, local, other, 'nameField')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(JSON.stringify(result.output)).toContain('"nameField"')
      })
    })
  })

  describe('given a deleted element carrying a constructor child', () => {
    describe('when both live sides dropped it', () => {
      it('then it stays deleted', () => {
        // Arrange
        const ancestor = { constructor: 'A' }
        const sut = new PropertyMergeNode(ancestor, {}, {}, 'wrapper')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given both sides added the element with an inherited key name', () => {
    describe('when the ancestor lacks the element', () => {
      it('then the child conflict carries no inherited ancestor', () => {
        // Arrange
        const local = { constructor: 'A' }
        const other = { constructor: 'B' }
        const sut = new PropertyMergeNode({}, local, other, 'wrapper')

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({
          output: [
            {
              wrapper: [
                buildConflictMarkers(
                  [{ constructor: 'A' }],
                  [],
                  [{ constructor: 'B' }]
                ),
              ],
            },
          ],
          hasConflict: true,
        })
      })
    })
  })

  describe('given objects nested 1900 levels deep', () => {
    const DEPTH = 1900
    const nested = (leaf: string): JsonObject =>
      Array.from({ length: DEPTH }).reduce<JsonObject>(
        (inner: JsonObject) => ({ level: inner }),
        { leaf }
      )

    it('when merging an edit at the deepest level then the stack holds', () => {
      // Arrange
      const sut = new PropertyMergeNode(
        nested('base'),
        nested('edited'),
        nested('base'),
        'wrapper'
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('given sides reordering the child tags of one element', () => {
    const body = (text: string): JsonObject =>
      Object.fromEntries([...text].map(key => [key, key]))

    it.each([
      ['local first', 'bac', 'acb'],
      ['other first', 'acb', 'bac'],
    ])(
      'given %s: a cycle among the pairwise orders when merging then the element holds one block with each side as written',
      (_side, local, other) => {
        // Arrange
        const sut = new PropertyMergeNode(
          body('abc'),
          body(local),
          body(other),
          'wrapper'
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(result.output).toEqual([
          {
            wrapper: [
              buildConflictMarkers(body(local), body('abc'), body(other)),
            ],
          },
        ])
      }
    )

    it('given a cycle and a value one side also changed when merging then the block holds each side verbatim', () => {
      // Arrange
      const local = { ...body('bac'), c: 'changed' }
      const sut = new PropertyMergeNode(
        body('abc'),
        local,
        body('acb'),
        'wrapper'
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.output).toEqual([
        {
          wrapper: [buildConflictMarkers(local, body('abc'), body('acb'))],
        },
      ])
    })

    it.each([
      ['local first', 'bacd', 'abdc'],
      ['other first', 'abdc', 'bacd'],
    ])(
      'given %s: swaps on disjoint pairs when merging then both swaps hold without conflict',
      (_side, local, other) => {
        // Arrange
        const sut = new PropertyMergeNode(
          body('abcd'),
          body(local),
          body(other),
          'wrapper'
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([
          { wrapper: [{ b: 'b' }, { a: 'a' }, { d: 'd' }, { c: 'c' }] },
        ])
      }
    )

    it.each([
      ['local', 'bac', 'abc'],
      ['other', 'abc', 'bac'],
    ])(
      'given only %s reordering when merging then the reorder holds without conflict',
      (_side, local, other) => {
        // Arrange
        const sut = new PropertyMergeNode(
          body('abc'),
          body(local),
          body(other),
          'wrapper'
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([
          { wrapper: [{ b: 'b' }, { a: 'a' }, { c: 'c' }] },
        ])
      }
    )
  })
})
