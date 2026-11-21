import fc from 'fast-check'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { contextOf } from '../../../../utils/orderedContext.js'
import {
  keyTokens,
  type MovedCase,
  movedCaseArb,
  movedEvery,
  stridedCaseArb,
  toOrderedSide,
} from '../../../../utils/orderedMoves.js'
import {
  merge,
  ordered,
  render,
  type Side,
  sidesArb,
} from '../../laws/arbitraries.js'

const MAX_MOVED_SIZE = 300
// Two thousand entries through the head and the reference under coverage take
// seconds when the suite's workers compete for the machine
const MANY_KEYS_TIMEOUT_MS = 30_000
// Moves as many entries as the tournament needs to count by dominance
const MANY_KEYS = 2_000
const LOCAL_MOVES = { stride: 8, shift: 3 } as const
const OTHER_MOVES = { stride: 4, shift: 1 } as const
// The random moves of movedCaseArb stay under both thresholds of the
// precedence (a few tens of entries moved by other, fewer by both), where the
// head runs the pairwise code the reference holds. Strided moves over this
// many keys pass both, a third of them moved by other and a sixth by both: the
// tournament counts by dominance from 80 entries moved by other, the overlaps
// are joined by component from 64 moved by both
const STRIDED_SIZES = { min: 400, max: 480 } as const
const SCORE_SWEEP_FROM = 80
const OVERLAP_SWEEP_FROM = 64
const STRIDED_RUNS = 20

const toSides = (generated: MovedCase) =>
  [
    toOrderedSide(generated.ancestor),
    toOrderedSide(generated.local),
    toOrderedSide(generated.other),
  ] as const satisfies readonly [Side, Side, Side]

const movedSidesArb = movedCaseArb(MAX_MOVED_SIZE).map(toSides)
const stridedArb = stridedCaseArb(STRIDED_SIZES.min, STRIDED_SIZES.max)

const movedCounts = ({ ancestor, local, other }: MovedCase) => {
  const ctx = contextOf(ancestor, local, other)
  const byOther = ctx.keptByAll.filter(entry => ctx.moved.other.has(entry.id))
  const byBoth = byOther.filter(entry => ctx.moved.local.has(entry.id))
  return { byOther: byOther.length, byBoth: byBoth.length }
}

describe('given sampled strided sides', () => {
  describe('when the entries they move are counted', () => {
    it('then every case passes both thresholds of the precedence', () => {
      // Arrange
      const sampled = fc.sample(stridedArb, STRIDED_RUNS)

      // Act
      const sut = sampled.map(movedCounts)

      // Assert
      for (const { byOther, byBoth } of sut) {
        expect(byOther).toBeGreaterThanOrEqual(SCORE_SWEEP_FROM)
        expect(byBoth).toBeGreaterThanOrEqual(OVERLAP_SWEEP_FROM)
      }
    })
  })
})

describe('given generated sides', () => {
  let reference: typeof import('../../laws/arbitraries.js')
  beforeAll(async () => {
    vi.resetModules()
    vi.doMock(
      '../../../../../src/merger/nodes/ordered/precedence.js',
      () => import('../../../../utils/oracles/pairwisePrecedence.js')
    )
    reference = await import('../../laws/arbitraries.js')
    vi.doUnmock('../../../../../src/merger/nodes/ordered/precedence.js')
  })

  describe('when merged with the pairwise precedence wired in', () => {
    it('then output, conflict and rendering are identical', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(sidesArb(ordered), movedSidesArb),
          async ([ancestor, local, other]) => {
            // Arrange
            const expected = reference.merge(ordered, ancestor, local, other)

            // Act
            const sut = merge(ordered, ancestor, local, other)

            // Assert
            expect(sut.hasConflict).toBe(expected.hasConflict)
            expect(sut.output).toEqual(expected.output)
            expect(await render(sut.output)).toBe(
              await reference.render(expected.output)
            )
          }
        )
      )
    })

    it(
      'then strided moves past both thresholds give the same output, conflict and rendering',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            stridedArb.map(toSides),
            async ([ancestor, local, other]) => {
              // Arrange
              const expected = reference.merge(ordered, ancestor, local, other)

              // Act
              const sut = merge(ordered, ancestor, local, other)

              // Assert
              expect(sut.hasConflict).toBe(expected.hasConflict)
              expect(sut.output).toEqual(expected.output)
              expect(await render(sut.output)).toBe(
                await reference.render(expected.output)
              )
            }
          ),
          { numRuns: STRIDED_RUNS }
        )
      },
      MANY_KEYS_TIMEOUT_MS
    )

    it(
      'then a thousand moved entries give the same output, conflict and rendering',
      async () => {
        // Arrange
        const keys = keyTokens(MANY_KEYS)
        const [ancestor, local, other] = [
          keys,
          movedEvery(keys, LOCAL_MOVES.stride, LOCAL_MOVES.shift),
          movedEvery(keys, OTHER_MOVES.stride, OTHER_MOVES.shift),
        ].map(tokens => toOrderedSide(tokens.join(' ')))
        const expected = reference.merge(ordered, ancestor, local, other)

        // Act
        const sut = merge(ordered, ancestor, local, other)

        // Assert
        expect(sut.hasConflict).toBe(expected.hasConflict)
        expect(sut.output).toEqual(expected.output)
        expect(await render(sut.output)).toBe(
          await reference.render(expected.output)
        )
      },
      MANY_KEYS_TIMEOUT_MS
    )
  })
})
