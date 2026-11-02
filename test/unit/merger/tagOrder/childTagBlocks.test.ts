import { describe, expect, it } from 'vitest'
import { ChildTagBlocks } from '../../../../src/merger/tagOrder/childTagBlocks.js'

describe('ChildTagBlocks', () => {
  describe('given tags joined two by two', () => {
    it('when asking for the representatives then each tag gets the smallest tag of its group', () => {
      // Arrange
      const sut = new ChildTagBlocks(5, [[0, 1, 2, 3, 4]])

      // Act
      sut.join(3, 1)
      sut.join(4, 2)
      sut.join(2, 3)

      // Assert
      expect(sut.representatives()).toEqual([0, 1, 1, 1, 1])
    })
  })

  describe('given a group that a side writes around another tag', () => {
    it('when settled then the tag written between them joins the group', () => {
      // Arrange
      const sut = new ChildTagBlocks(4, [
        [0, 3, 1, 2],
        [2, 0, 1, 3],
      ])
      sut.join(0, 1)

      // Act
      sut.settle()

      // Assert
      expect(sut.representatives()).toEqual([0, 0, 2, 0])
    })
  })

  describe('given a group whose tags stand apart in an order of the tags themselves', () => {
    it('when settled then the tags between them join the group', () => {
      // Arrange
      const order = [0, 1, 2, 3, 4]
      const sut = new ChildTagBlocks(5, [order, order])
      sut.join(0, 3)

      // Act
      sut.settle()

      // Assert
      expect(sut.representatives()).toEqual([0, 0, 0, 0, 4])
    })
  })

  describe('given a chain of joins that always attaches the larger group on the right', () => {
    it('when finding a tag then the search does not overflow the stack', () => {
      // Arrange
      const size = 200000
      const order = Array.from({ length: size }, (_, tag) => tag)
      const sut = new ChildTagBlocks(size, [order])
      for (let tag = 1; tag < size; tag++) sut.join(tag, tag - 1)

      // Act
      const root = sut.find(0)

      // Assert
      expect(sut.find(size - 1)).toBe(root)
    })
  })
})
