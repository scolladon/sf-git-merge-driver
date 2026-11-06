import fc from 'fast-check'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  keyTokens,
  movedCaseArb,
  movedEvery,
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

const movedSidesArb = movedCaseArb(MAX_MOVED_SIZE).map(
  generated =>
    [
      toOrderedSide(generated.ancestor),
      toOrderedSide(generated.local),
      toOrderedSide(generated.other),
    ] as const satisfies readonly [Side, Side, Side]
)

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
