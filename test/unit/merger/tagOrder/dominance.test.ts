import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  belowOnAll,
  belowOnBoth,
  orderedBy,
} from '../../../../src/merger/tagOrder/dominance.js'
import {
  belowOnAll as referenceBelowOnAll,
  belowOnBoth as referenceBelowOnBoth,
  orderedBy as referenceOrderedBy,
} from '../../../utils/oracles/comparatorDominance.js'

const MAX_POINTS = 120
// Far above any dense range, so that a sparse coordinate never takes the
// counting placement once it holds two points
const SPREAD = 1000

const range = (size: number): number[] =>
  Array.from({ length: size }, (_, at) => at)

const permutationArb = (size: number) =>
  fc.shuffledSubarray(range(size), { minLength: size, maxLength: size })

const pointCountArb = fc.integer({ min: 0, max: MAX_POINTS })

// Coordinates are distinct integers: each one is a permutation of the points
const permutationsArb = (count: number) =>
  pointCountArb.chain(size =>
    fc.tuple(...Array.from({ length: count }, () => permutationArb(size)))
  )

// Distinct integers in a dense range
const denseArb = (size: number) =>
  fc
    .tuple(permutationArb(size), fc.integer({ min: -size, max: size }))
    .map(([permutation, offset]) => permutation.map(at => at + offset))

// Distinct integers in a range far wider than the number of points
const sparseArb = (size: number) =>
  permutationArb(size).map(permutation => permutation.map(at => at * SPREAD))

// Distinct numbers, half of them not integers
const fractionalArb = (size: number) =>
  permutationArb(size).map(permutation =>
    permutation.map(at => at + (at % 2) / 2)
  )

const coordinateArb = (size: number) =>
  fc.oneof(denseArb(size), sparseArb(size), fractionalArb(size))

// Values that repeat, whole or halved, so that ties meet both orderings
const duplicatesArb = fc.array(fc.integer({ min: -20, max: 20 }), {
  maxLength: 200,
})
const halvedDuplicatesArb = duplicatesArb.map(values =>
  values.map(value => value / 2)
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

  describe('given numbers none of which is an integer', () => {
    it('when ordering fractions that differ below the unit then they are ordered by value', () => {
      // Arrange
      const values = [0.75, 0.25, 0.5]

      // Act
      const sut = orderedBy(values)

      // Assert
      expect([...sut]).toEqual([1, 2, 0])
    })
  })

  describe('given two integers further apart than any array can span', () => {
    it('when ordering them then they are ordered without a slot for each integer between', () => {
      // Arrange
      const values = [0, 2 ** 52]

      // Act
      const sut = orderedBy(values)

      // Assert
      expect([...sut]).toEqual([0, 1])
    })
  })

  describe('given the comparator-sort reference', () => {
    it('when ordering points then the order equals the reference element for element', () => {
      fc.assert(
        fc.property(pointCountArb.chain(coordinateArb), values => {
          // Arrange
          const expected = referenceOrderedBy(values)

          // Act
          const sut = orderedBy(values)

          // Assert
          expect([...sut]).toEqual([...expected])
        })
      )
    })

    it('when ordering equal values then the ties stay in index order as in the reference', () => {
      fc.assert(
        fc.property(fc.oneof(duplicatesArb, halvedDuplicatesArb), values => {
          // Arrange
          const expected = referenceOrderedBy(values)

          // Act
          const sut = orderedBy(values)

          // Assert
          expect([...sut]).toEqual([...expected])
        })
      )
    })

    it('when counting below on two coordinates then every count equals the reference', () => {
      fc.assert(
        fc.property(
          pointCountArb.chain(size =>
            fc.tuple(coordinateArb(size), coordinateArb(size))
          ),
          ([first, second]) => {
            // Arrange
            const expected = referenceBelowOnBoth(first, second)

            // Act
            const sut = belowOnBoth(first, second)

            // Assert
            expect([...sut]).toEqual([...expected])
          }
        )
      )
    })

    it('when counting below on three coordinates then every count equals the reference', () => {
      fc.assert(
        fc.property(
          pointCountArb.chain(size =>
            fc.tuple(
              coordinateArb(size),
              coordinateArb(size),
              coordinateArb(size)
            )
          ),
          ([first, second, third]) => {
            // Arrange
            const expected = referenceBelowOnAll(first, second, third)

            // Act
            const sut = belowOnAll(first, second, third)

            // Assert
            expect([...sut]).toEqual([...expected])
          }
        ),
        { numRuns: 300 }
      )
    })
  })
})
