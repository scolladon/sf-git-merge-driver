import fc from 'fast-check'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  orderedComponents,
  pairStanding,
  type SharedPositions,
  sweepStanding,
} from '../../../../src/merger/tagOrder/childTagRelation.js'
import { mergePropertyOrder } from '../../../../src/merger/tagOrder/mergePropertyOrder.js'
import { ABSENT } from '../../../../src/merger/tagOrder/tagPositions.js'
import {
  orderedComponents as referenceOrderedComponents,
  sweepStanding as referenceSweepStanding,
} from '../../../utils/oracles/comparatorDominance.js'

const MAX_TAGS = 150
// The merge takes the sweeps from 256 shared tags
const SWEEP_TAGS_MIN = 256
const SWEEP_TAGS_MAX = 400
const SPARE_TAGS = 16

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

const positionsOf = (
  sizes: fc.Arbitrary<number>
): fc.Arbitrary<SharedPositions> =>
  sizes.chain(size =>
    fc.record({
      ancestor: ancestorArb(size),
      local: permutationArb(size),
      other: permutationArb(size),
    })
  )

const positionsArb = positionsOf(fc.integer({ min: 0, max: MAX_TAGS }))

const sweptPositionsArb = positionsOf(
  fc.integer({ min: SWEEP_TAGS_MIN, max: SWEEP_TAGS_MAX })
)

// Letters first: integer-like keys reorder in JS objects
const tagName = (at: number): string => `T${String(at).padStart(5, '0')}`

const bodyOf = (tags: readonly string[]) =>
  Object.fromEntries(tags.map(tag => [tag, 'v']))

// Each side leaves out as many tags as the pool spares at most, so the sides
// share enough of them for the sweeps whatever they drop
const bodiesArb = fc
  .integer({ min: SWEEP_TAGS_MIN + SPARE_TAGS, max: SWEEP_TAGS_MAX })
  .chain(size => {
    const pool = Array.from({ length: size + SPARE_TAGS }, (_, at) =>
      tagName(at)
    )
    const sideArb = fc.shuffledSubarray(pool, { minLength: size })
    return fc.record({
      ancestor: fc.shuffledSubarray(pool.slice(0, size), {
        minLength: size,
        maxLength: size,
      }),
      local: sideArb,
      other: sideArb,
    })
  })

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

    it('when standing is counted by sweeps then it equals the comparator-sort reference', () => {
      fc.assert(
        fc.property(positionsArb, positions => {
          // Arrange
          const expected = referenceSweepStanding(positions)

          // Act
          const sut = sweepStanding(positions)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })

    it('when ordering the components then they equal the reference', () => {
      fc.assert(
        fc.property(positionsArb, positions => {
          // Arrange
          const expected = referenceOrderedComponents(positions)

          // Act
          const sut = orderedComponents(positions)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })
  })

  describe('given the positions of enough shared tags for the sweeps', () => {
    it('when ordering the components then they equal the reference', () => {
      fc.assert(
        fc.property(sweptPositionsArb, positions => {
          // Arrange
          const expected = referenceOrderedComponents(positions)

          // Act
          const sut = orderedComponents(positions)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })
  })

  describe('given bodies of 272 to 400 child tags', () => {
    let reference: typeof import('../../../../src/merger/tagOrder/mergePropertyOrder.js')
    beforeAll(async () => {
      vi.resetModules()
      vi.doMock(
        '../../../../src/merger/tagOrder/childTagRelation.js',
        () => import('../../../utils/oracles/comparatorDominance.js')
      )
      reference = await import(
        '../../../../src/merger/tagOrder/mergePropertyOrder.js'
      )
      vi.doUnmock('../../../../src/merger/tagOrder/childTagRelation.js')
    })

    it('when merging their order with the reference wired in then the order and the blocks are identical', () => {
      fc.assert(
        fc.property(bodiesArb, ({ ancestor, local, other }) => {
          // Arrange
          const [ancestorBody, localBody, otherBody] = [
            ancestor,
            local,
            other,
          ].map(bodyOf)
          const expected = reference.mergePropertyOrder(
            ancestorBody,
            localBody,
            otherBody
          )

          // Act
          const sut = mergePropertyOrder(ancestorBody, localBody, otherBody)

          // Assert
          expect(sut.order).toEqual(expected.order)
          expect([...sut.blocks.entries()]).toEqual([
            ...expected.blocks.entries(),
          ])
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
