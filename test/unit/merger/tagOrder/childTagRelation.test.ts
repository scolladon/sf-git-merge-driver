import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  orderedComponents,
  pairStanding,
  type SharedPositions,
  sweepStanding,
} from '../../../../src/merger/tagOrder/childTagRelation.js'
import { ABSENT } from '../../../../src/merger/tagOrder/tagPositions.js'

const MAX_TAGS = 150

const range = (size: number): number[] =>
  Array.from({ length: size }, (_, at) => at)

const permutationArb = (size: number) =>
  fc.shuffledSubarray(range(size), { minLength: size, maxLength: size })

// Where the ancestor stands for the tags it carries, ABSENT for the others
const ancestorArb = (size: number) =>
  fc.shuffledSubarray(range(size)).map(carried => {
    const positions = new Array<number>(size).fill(ABSENT)
    carried.forEach((tag, at) => {
      positions[tag] = at
    })
    return positions
  })

const positionsArb: fc.Arbitrary<SharedPositions> = fc
  .integer({ min: 0, max: MAX_TAGS })
  .chain(size =>
    fc.record({
      ancestor: ancestorArb(size),
      local: permutationArb(size),
      other: permutationArb(size),
    })
  )

describe('childTagRelation', () => {
  describe('given the positions of the tags both live sides carry', () => {
    it('when standing is counted by sweeps then it matches the count pair by pair', () => {
      fc.assert(
        fc.property(positionsArb, positions => {
          // Arrange
          const expected = pairStanding(positions)

          // Act
          const sut = sweepStanding(positions)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })
  })

  describe('given sides that invert the ancestor on overlapping pairs', () => {
    it('when ordering the components then the tags of a cycle share one component', () => {
      // Arrange
      const positions = {
        ancestor: [0, 1, 2],
        local: [1, 0, 2],
        other: [0, 2, 1],
      }

      // Act
      const sut = orderedComponents(positions)

      // Assert
      expect(sut).toEqual([[0, 1, 2]])
    })
  })

  describe('given sides that invert the ancestor on disjoint pairs', () => {
    it('when ordering the components then each tag has its own, in the merged order', () => {
      // Arrange
      const positions = {
        ancestor: [0, 1, 2, 3],
        local: [1, 0, 2, 3],
        other: [0, 1, 3, 2],
      }

      // Act
      const sut = orderedComponents(positions)

      // Assert
      expect(sut).toEqual([[1], [0], [3], [2]])
    })
  })
})
