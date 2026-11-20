import { describe, expect, it } from 'vitest'
import {
  mergeTagsInOrder,
  propertyOrderConflict,
} from '../../../../src/merger/tagOrder/propertyOrderConflict.js'
import { noConflict } from '../../../../src/types/mergeResult.js'

describe('propertyOrderConflict', () => {
  describe('given the three sides of an element and the tags of a cycle', () => {
    it('when building the conflict then one block holds those tags in each side own order', () => {
      // Arrange
      const sides = {
        ancestor: { a: '1', b: '2', c: '3', z: '9' },
        local: { z: '9', b: '2', a: '1', c: '3' },
        other: { a: '1', c: '3', b: '4', z: '9' },
      }

      // Act
      const sut = propertyOrderConflict(sides, ['a', 'b', 'c'])

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toEqual([
        {
          __conflict: true,
          local: [{ b: '2', a: '1', c: '3' }],
          ancestor: [{ a: '1', b: '2', c: '3' }],
          other: [{ a: '1', c: '3', b: '4' }],
        },
      ])
    })
  })

  describe('given no ancestor', () => {
    it('when building the conflict then the ancestor side of the block is empty', () => {
      // Arrange
      const sides = {
        ancestor: undefined,
        local: { a: '1', b: '2' },
        other: { b: '2', a: '1' },
      }

      // Act
      const sut = propertyOrderConflict(sides, ['a', 'b'])

      // Assert
      expect(sut.output).toEqual([
        {
          __conflict: true,
          local: [{ a: '1', b: '2' }],
          ancestor: [],
          other: [{ b: '2', a: '1' }],
        },
      ])
    })
  })
})

describe('mergeTagsInOrder', () => {
  describe('given a merged order that names a block and a tag', () => {
    it('when merging then the block conflicts whole and the tag is merged on its own', () => {
      // Arrange
      const merged = {
        order: ['a', 'z'],
        blocks: new Map([['a', ['a', 'b']]]),
      }
      const sides = {
        ancestor: { a: '1', b: '2', z: '3' },
        local: { b: '2', a: '1', z: '3' },
        other: { a: '1', b: '2', z: '3' },
      }
      const mergedTags: string[] = []

      // Act
      const sut = mergeTagsInOrder(merged, sides, tag => {
        mergedTags.push(tag)
        return noConflict([{ [tag]: sides.local.z }])
      })

      // Assert
      expect(mergedTags).toEqual(['z'])
      expect(sut.map(result => result.hasConflict)).toEqual([true, false])
    })
  })
})
