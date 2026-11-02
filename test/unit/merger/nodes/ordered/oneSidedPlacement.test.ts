import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { placeOneSided } from '../../../../../src/merger/nodes/ordered/oneSidedPlacement.js'
import { LIVE_SIDES } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import { placeAgreedInsertions } from '../../../../../src/merger/nodes/ordered/placement.js'
import { tournament } from '../../../../../src/merger/nodes/ordered/precedence.js'
import { contextOf, keysOf } from '../../../../utils/orderedContext.js'

const placementOf = (ancestor: string, local: string, other: string) => {
  const ctx = contextOf(ancestor, local, other)
  const { spine } = placeAgreedInsertions(ctx, tournament(ctx))
  const sut = placeOneSided(ctx, spine)
  return { ctx, spine, sut }
}

const compact = (keys: readonly string[]): string => keys.join('')

const outputOf = (placement: ReturnType<typeof placementOf>): string =>
  compact(keysOf(placement.ctx, placement.sut.output))

const joinedOf = (placement: ReturnType<typeof placementOf>): string[] =>
  [
    ...new Set(
      placement.sut.marks.joins
        .filter(([first, second]) => first !== second)
        .map(join => compact(keysOf(placement.ctx, join).slice().sort()))
    ),
  ].sort()

// Linear placement takes ~25 ms at LARGE_SHARED_SIZE under coverage; recomputing
// the ranks ahead per insertion takes ~6 s. The bound sits between the two so
// that CPU load and coverage instrumentation cannot push the linear code over it.
const MAX_PLACEMENT_MS = 500
const LARGE_SHARED_SIZE = 24_000
const CONTEXT_BUILD_TIMEOUT_MS = 120_000

const SHARED = ['A', 'B', 'C', 'D', 'E']

const sideOf = (inserted: readonly string[]) =>
  fc
    .tuple(
      fc.shuffledSubarray(SHARED, { minLength: 1 }),
      fc.shuffledSubarray([...inserted]),
      fc.nat(SHARED.length)
    )
    .map(([kept, added, at]) =>
      [...kept.slice(0, at), ...added, ...kept.slice(at)].join(' ')
    )

const placementArbitrary = fc
  .tuple(
    fc.shuffledSubarray(SHARED, { minLength: 1 }),
    sideOf(['X', 'Y', 'Z']),
    sideOf(['P', 'Q', 'R'])
  )
  .map(([ancestor, local, other]) =>
    placementOf(ancestor.join(' '), local, other)
  )

describe('placeOneSided', () => {
  describe('given any ordered readings', () => {
    describe('when placing the one-sided entries', () => {
      it('then each present entry appears once and the spine keeps its order', () => {
        fc.assert(
          fc.property(placementArbitrary, ({ ctx, spine, sut }) => {
            // Arrange
            const spineIds = spine.entries.map(entry => entry.id)

            // Act
            const { output } = sut

            // Assert
            expect([...output].sort((a, b) => a - b)).toEqual(
              ctx.view
                .filter(entry => ctx.statuses[entry.id]?.kind !== 'gone')
                .map(entry => entry.id)
            )
            expect(output.filter(id => spine.rank.has(id))).toEqual(spineIds)
          })
        )
      })

      it('then each side keeps the written order of its one-sided entries', () => {
        fc.assert(
          fc.property(placementArbitrary, ({ ctx, spine, sut }) => {
            for (const side of LIVE_SIDES) {
              // Arrange
              const written = ctx.sequence[side]
                .map(entry => entry.id)
                .filter(id => !spine.rank.has(id))

              // Act
              const placed = sut.output.filter(id => written.includes(id))

              // Assert
              expect(placed).toEqual(written)
            }
          })
        )
      })
    })
  })

  describe('given entries one side inserted after the shared ones', () => {
    describe('when the shared entries were swapped by the other side', () => {
      it('then the output follows the merged shared order without marks', () => {
        // Arrange
        const placement = placementOf('A B', 'B A', 'A B X')

        // Act
        const { sut } = placement

        // Assert
        expect(outputOf(placement)).toBe('BAX')
        expect(sut.marks).toEqual({ joins: [], seeds: [] })
      })
    })
  })

  describe('given entries both sides inserted into the same slot', () => {
    describe('when placing them', () => {
      it('then they are joined and share the slot', () => {
        // Arrange
        const placement = placementOf('K B', 'B X K', 'B Y K')

        // Act
        const { sut } = placement

        // Assert
        expect(outputOf(placement)).toBe('BXYK')
        expect(joinedOf(placement)).toEqual(['XY'])
        expect(sut.marks.seeds).toEqual([])
      })
    })
  })

  describe('given an insertion between shared entries the merged order reverses', () => {
    describe('when placing it', () => {
      it.each([
        ['A B', 'A X B', 'B A', ['X'], ['AX', 'BX']],
        [
          'A B C D',
          'A X B C Y D',
          'C D A B',
          ['X', 'Y'],
          ['AX', 'AY', 'BY', 'CX', 'DX', 'DY'],
        ],
      ])(
        'then %s / %s / %s seeds %j and joins it with the spine',
        (a, l, o, seeded, joined) => {
          // Arrange
          const placement = placementOf(a, l, o)

          // Act
          const { sut } = placement

          // Assert
          expect(keysOf(placement.ctx, sut.marks.seeds).slice().sort()).toEqual(
            seeded
          )
          expect(joinedOf(placement)).toEqual(joined)
        }
      )
    })
  })

  describe('given one-sided entries that the shared entries keep apart', () => {
    describe('when placing them', () => {
      it.each([
        ['P', 'P D', 'P B D', 'PBD'],
        ['A', 'A X Y', 'A', 'AXY'],
        ['A', 'A', 'A X Y', 'AXY'],
        ['A B', 'A X B', 'A B Y', 'AXBY'],
        ['A B C', 'A X B C', 'A B C Y', 'AXBCY'],
      ])('then %s / %s / %s outputs %s without marks', (a, l, o, output) => {
        // Arrange
        const placement = placementOf(a, l, o)

        // Act
        const { sut } = placement

        // Assert
        expect(outputOf(placement)).toBe(output)
        expect(sut.marks).toEqual({ joins: [], seeds: [] })
      })
    })
  })

  describe('given replacements of both sides that inherited a place', () => {
    describe('when placing them in the same slot', () => {
      it('then the ancestor place orders them without a join', () => {
        // Arrange
        const placement = placementOf('A B C D', 'Z B', 'C X')

        // Act
        const { sut } = placement

        // Assert
        expect(outputOf(placement)).toBe(
          'BZXCD'.replace(/[BCD]/g, '').length ? 'ZX' : ''
        )
        expect(sut.marks).toEqual({ joins: [], seeds: [] })
      })

      it('then the order of the sides does not matter', () => {
        // Arrange
        const placement = placementOf('A B C D', 'C X', 'Z B')

        // Act
        const result = outputOf(placement)

        // Assert
        expect(result).toBe('ZX')
      })
    })

    describe('when the assembled order contradicts their places', () => {
      it('then the two replacements are joined', () => {
        // Arrange
        const placement = placementOf('~a ~b ~a', '~p ~p ~b', '~b ~q ~p')

        // Act
        const result = joinedOf(placement)

        // Assert
        expect(result).toContain('~p~q')
      })
    })
  })

  describe('given a replacement and an insertion of the other side in one gap', () => {
    describe('when placing them', () => {
      it('then nothing says who comes first and they are joined', () => {
        // Arrange
        const placement = placementOf('A B C', 'B X', 'Y A')

        // Act
        const result = joinedOf(placement)

        // Assert
        expect(result).toEqual(['XY'])
      })
    })
  })

  describe('given one-sided entries from both sides in one gap', () => {
    describe('when placing them', () => {
      it.each([
        ['A B', 'B A X', 'A B Y', ['XY']],
        ['A B', 'A X B', 'A Y Z W B', ['WX', 'XY', 'XZ']],
      ])('then %s / %s / %s joins %j', (a, l, o, joined) => {
        // Arrange
        const placement = placementOf(a, l, o)

        // Act
        const result = joinedOf(placement)

        // Assert
        expect(result).toEqual(joined)
        expect(placement.sut.marks.seeds).toEqual([])
      })
    })
  })

  describe('given thousands of shared entries with many one-sided insertions per side', () => {
    describe('when placing them', () => {
      it(
        'then it stays far from quadratic time',
        () => {
          // Arrange
          const shared = Array.from(
            { length: LARGE_SHARED_SIZE },
            (_, index) => `K${index}`
          )
          const withInsertions = (
            every: number,
            prefix: string,
            rest: number
          ) =>
            shared.flatMap((key, index) =>
              index % every === rest ? [key, `${prefix}${index}`] : [key]
            )
          const ctx = contextOf(
            shared.join(' '),
            withInsertions(5, 'L', 1).join(' '),
            withInsertions(5, 'O', 3).join(' ')
          )
          const { spine } = placeAgreedInsertions(ctx, tournament(ctx))
          const start = performance.now()

          // Act
          const sut = placeOneSided(ctx, spine)

          // Assert
          expect(performance.now() - start).toBeLessThan(MAX_PLACEMENT_MS)
          expect(sut.output).toHaveLength(
            LARGE_SHARED_SIZE + (2 * LARGE_SHARED_SIZE) / 5
          )
          expect(sut.marks.joins).toEqual([])
        },
        CONTEXT_BUILD_TIMEOUT_MS
      )
    })
  })
})
