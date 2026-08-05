import { describe, expect, it } from 'vitest'
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { PropertyMergeNode } from '../../../../src/merger/nodes/PropertyMergeNode.js'
import { TextArrayMergeNode } from '../../../../src/merger/nodes/TextArrayMergeNode.js'
import { TextMergeNode } from '../../../../src/merger/nodes/TextMergeNode.js'
import { defaultConfig } from '../../../utils/testConfig.js'

describe('MergeNodeFactory', () => {
  describe('defaultNodeFactory', () => {
    const factory = defaultNodeFactory

    describe('createNode', () => {
      it('given string arrays when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = ['a', 'b']
        const local = ['c', 'd']
        const other = ['e', 'f']

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given one string array when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = ['a', 'b']
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given attribute=members with scalar values on all three sides (cardinality 1) then returns TextArrayMergeNode', () => {
        // Arrange — a single occurrence on every side parses to a bare
        // scalar (isStringArray sees no array at all), but 'members' is a
        // known text-array attribute regardless of incidental cardinality.
        const ancestor = 'Obj1'
        const local = 'Obj1b'
        const other = 'Obj1'

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given an unrelated attribute with scalar values on all three sides then still returns TextMergeNode', () => {
        // Arrange — regression guard: the forced routing must not leak to
        // every scalar attribute, only the ones MetadataService lists.
        const ancestor = 'Obj1'
        const local = 'Obj1b'
        const other = 'Obj1'

        // Act
        const node = factory.createNode(ancestor, local, other, 'name')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given attribute=members with object-shaped values then returns PropertyMergeNode, not TextArrayMergeNode', () => {
        // Arrange — the schema override exists to defeat an *incidental*
        // cardinality check, not the shape checks below it. TextArrayMergeNode
        // dedups with `new Set(items)` (reference identity — never matches
        // across two parsed sides) and sorts via JSON.stringify, so routing
        // object-shaped values there unions every side instead of merging
        // them property by property.
        const ancestor = { sub: 'a' }
        const local = { sub: 'b' }
        const other = { sub: 'a' }

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given objects when createNode then returns PropertyMergeNode', () => {
        // Arrange
        const ancestor = { a: 1 }
        const local = { b: 2 }
        const other = { c: 3 }

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given one object when createNode then returns PropertyMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = { a: 1 }
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given primitives when createNode then returns TextMergeNode', () => {
        // Arrange
        const ancestor = 'x'
        const local = 'y'
        const other = 'z'

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given all nil when createNode then returns TextMergeNode', () => {
        // Arrange
        // Act
        const node = factory.createNode(
          undefined as never,
          undefined as never,
          null,
          'attr'
        )

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given empty array when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local: string[] = []
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given array with mixed types when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = ['a', 1]
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      it('given array with objects when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange
        const ancestor = undefined as never
        const local = ['a', { b: 1 }]
        const other = null

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      it('given object and array values when createNode then returns KeyedArrayMergeNode not PropertyMergeNode', () => {
        // Arrange - one value is an array, which prevents isPureUnknown from returning true
        const ancestor = { a: 1 }
        const local = [{ b: 2 }]
        const other = { c: 3 }

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
        expect(node).not.toBeInstanceOf(PropertyMergeNode)
      })

      it('given objects with known key extractor when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange - 'customValue' has a key extractor in MetadataService
        const ancestor = { fullName: 'A' }
        const local = { fullName: 'B' }
        const other = { fullName: 'C' }

        // Act
        const node = factory.createNode(ancestor, local, other, 'customValue')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      describe('given a side where the element is absent or not a pure object', () => {
        const sut = defaultNodeFactory

        describe('when merging the node the factory creates', () => {
          it('should treat a null ancestor and an undefined other as empty objects', () => {
            // Arrange
            const ancestor = null
            const local = { a: 1 }
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ attr: [{ a: 1 }] }],
              hasConflict: false,
            })
          })

          it('should treat an undefined ancestor and an undefined local as empty objects', () => {
            // Arrange
            const ancestor = undefined as never
            const local = undefined as never
            const other = { a: 1 }

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ attr: [{ a: 1 }] }],
              hasConflict: false,
            })
          })

          it('should propagate the deletion when both live sides dropped the element', () => {
            // Arrange
            const ancestor = { a: 1 }
            const local = undefined as never
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({ output: [], hasConflict: false })
          })

          it('should let a scalar side contribute no keys at all', () => {
            // Arrange
            const ancestor = 'text'
            const local = { a: 1 }
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ attr: [{ a: 1 }] }],
              hasConflict: false,
            })
          })
        })
      })
    })
  })

  describe('defaultNodeFactory', () => {
    it('should be defined', () => {
      expect(defaultNodeFactory).toBeDefined()
      expect(defaultNodeFactory.createNode).toBeDefined()
    })
  })
})
