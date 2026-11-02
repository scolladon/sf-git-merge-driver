import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  belowOnAll,
  belowOnBoth,
} from '../../../../src/merger/tagOrder/dominance.js'

const MAX_POINTS = 120

const range = (size: number): number[] =>
  Array.from({ length: size }, (_, at) => at)

// Coordinates are distinct integers: each one is a permutation of the points
const permutationsArb = (count: number) =>
  fc
    .integer({ min: 0, max: MAX_POINTS })
    .chain(size =>
      fc.tuple(
        ...Array.from({ length: count }, () =>
          fc.shuffledSubarray(range(size), { minLength: size, maxLength: size })
        )
      )
    )

const naiveBelow = (coordinates: number[][]): number[] =>
  coordinates[0].map(
    (_, point) =>
      range(coordinates[0].length).filter(other =>
        coordinates.every(axis => axis[other] < axis[point])
      ).length
  )

describe('dominance', () => {
  describe('given points with two coordinates', () => {
    it('when counting what lies below each point then it matches the pair by pair count', () => {
      fc.assert(
        fc.property(permutationsArb(2), coordinates => {
          // Arrange
          const [first, second] = coordinates

          // Act
          const sut = belowOnBoth(first, second)

          // Assert
          expect([...sut]).toEqual(naiveBelow(coordinates))
        })
      )
    })
  })

  describe('given points with three coordinates', () => {
    it('when counting what lies below each point then it matches the pair by pair count', () => {
      fc.assert(
        fc.property(permutationsArb(3), coordinates => {
          // Arrange
          const [first, second, third] = coordinates

          // Act
          const sut = belowOnAll(first, second, third)

          // Assert
          expect([...sut]).toEqual(naiveBelow(coordinates))
        }),
        { numRuns: 300 }
      )
    })
  })

  describe('given no point', () => {
    it('when counting then nothing is counted', () => {
      // Arrange & Act
      const sut = belowOnAll([], [], [])

      // Assert
      expect([...sut]).toEqual([])
    })
  })
})
