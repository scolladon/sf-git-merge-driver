import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { PropertyMergeNode } from '../../../../src/merger/nodes/PropertyMergeNode.js'
import { TextArrayMergeNode } from '../../../../src/merger/nodes/TextArrayMergeNode.js'
import { TextMergeNode } from '../../../../src/merger/nodes/TextMergeNode.js'

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
    })
  })

  describe('defaultNodeFactory', () => {
    it('should be defined', () => {
      expect(defaultNodeFactory).toBeDefined()
      expect(defaultNodeFactory.createNode).toBeDefined()
    })
  })
})
