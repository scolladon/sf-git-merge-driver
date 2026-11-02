import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  ReadyTags,
  topologicalOrder,
} from '../../../../src/merger/tagOrder/topologicalOrder.js'

describe('ReadyTags', () => {
  describe('given tags added in any order', () => {
    it('when taking them then the lowest comes first each time', () => {
      fc.assert(
        fc.property(fc.array(fc.nat({ max: 1000 })), tags => {
          // Arrange
          const sut = new ReadyTags()
          for (const tag of tags) sut.add(tag)

          // Act
          const taken = tags.map(() => sut.takeLowest())

          // Assert
          expect(taken).toEqual([...tags].sort((x, y) => x - y))
          expect(sut.size).toBe(0)
        })
      )
    })
  })
})

describe('topologicalOrder', () => {
  const noneShared = (size: number) => new Array<boolean>(size).fill(false)

  describe('given lists that agree', () => {
    it('when ordering then every list keeps its order and the lowest tag goes first among the ready ones', () => {
      // Arrange
      const lists = [
        [3, 1],
        [2, 1],
      ]

      // Act
      const sut = topologicalOrder(lists, [], noneShared(4))

      // Assert
      expect(sut).toEqual([2, 3, 1])
    })
  })

  describe('given lists that contradict on tags no shared order holds', () => {
    it('when ordering then the cycle is broken at the tag with the lowest residual indegree', () => {
      // Arrange
      const lists = [
        [0, 1],
        [1, 0],
      ]

      // Act
      const sut = topologicalOrder(lists, [], noneShared(2))

      // Assert
      expect(sut).toEqual([0, 1])
    })
  })

  describe('given a shared order and a cycle through the tags around it', () => {
    it('when ordering then the shared tags keep their order', () => {
      // Arrange: 2 waits for 3 in one list, 3 for 1 in another, and 1 for 2
      const shared = [0, 1]
      const isShared = [true, true, false, false]
      const lists = [
        [0, 2, 1],
        [1, 3],
        [3, 2],
      ]

      // Act
      const sut = topologicalOrder(lists, shared, isShared)

      // Assert
      expect(sut.filter(tag => shared.includes(tag))).toEqual(shared)
    })
  })
})
