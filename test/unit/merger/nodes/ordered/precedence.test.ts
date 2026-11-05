import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { OrderedContext } from '../../../../../src/merger/nodes/ordered/orderedContext.js'
import {
  cycleMarks,
  orderOverlaps,
  pairOverlaps,
  pairScores,
  sweepScores,
  tournament,
} from '../../../../../src/merger/nodes/ordered/precedence.js'
import * as pairwise from '../../../../utils/oracles/pairwisePrecedence.js'
import {
  contextOf,
  keysOf,
  seededClasses,
} from '../../../../utils/orderedContext.js'
import {
  keyTokens,
  type MovedCase,
  movedCaseArb,
  movedEvery,
} from '../../../../utils/orderedMoves.js'

const MAX_GENERATED_SIZE = 300
// The generated orderings seldom move as many entries as the tournament needs
// to count by dominance; these do
const MANY_KEYS = 2_000
const MOVE_STRIDE = 4
const MOVE_SHIFT = 1
const OTHER_SHIFT = 2

const contextOfCase = (generated: MovedCase): OrderedContext =>
  contextOf(generated.ancestor, generated.local, generated.other)

const compact = (keys: readonly string[]): string => keys.join('')

describe('orderOverlaps', () => {
  describe('given an entry both sides moved with different partners', () => {
    describe('when sides flip it against different entries', () => {
      it('then it is seeded and joined with each partner', () => {
        // Arrange
        const ctx = contextOf('A B C D', 'B C A D', 'B A C D')

        // Act
        const sut = orderOverlaps(ctx)

        // Assert
        const joined = sut.joins.map(join => compact(keysOf(ctx, join)))
        expect(joined).toEqual(['AC'])
      })
    })

    describe('when both sides flip it against the same entries', () => {
      it('then nothing is marked', () => {
        // Arrange
        const ctx = contextOf('A B C D', 'B A D C', 'B A C D')

        // Act
        const sut = orderOverlaps(ctx)

        // Assert
        expect(sut.joins).toEqual([])
        expect(sut.seeds).toEqual([])
      })
    })
  })

  describe('given entries only one side moved', () => {
    describe('when computing overlaps', () => {
      it('then nothing is marked', () => {
        // Arrange
        const ctx = contextOf('A B C', 'B A C', 'A B C')

        // Act
        const sut = orderOverlaps(ctx)

        // Assert
        expect(sut.joins).toEqual([])
      })
    })
  })
})

describe('tournament', () => {
  const orderOf = (ancestor: string, local: string, other: string) => {
    const ctx = contextOf(ancestor, local, other)
    const sut = tournament(ctx)
    return {
      ctx,
      sut,
      order: compact(
        keysOf(
          ctx,
          sut.order.map(e => e.id)
        )
      ),
    }
  }

  describe('given sides that flip different pairs', () => {
    describe('when each flipped pair is won by the side that flipped it', () => {
      it.each([
        ['A B C D', 'B A D C', 'B A C D', 'BADC'],
        ['K A B C', 'A K B C', 'A K C B', 'AKCB'],
        ['A B C', 'A B C', 'A B C', 'ABC'],
        ['A B C', 'A B C', 'C A B', 'CAB'],
      ])('then %s / %s / %s orders %s', (a, l, o, expected) => {
        // Arrange / Act
        const { order, sut } = orderOf(a, l, o)

        // Assert
        expect(order).toBe(expected)
        expect(sut.cycleGroups).toEqual([])
        sut.order.forEach((entry, index) => {
          expect(sut.rank.get(entry.id)).toBe(index)
        })
      })
    })
  })

  describe('given a tournament', () => {
    describe('when ordering the entries', () => {
      it('then the context keeps its own kept-by-all order', () => {
        // Arrange
        const ctx = contextOf('A B C D', 'B A D C', 'B A C D')
        const before = ctx.keptByAll.map(entry => entry.id)

        // Act
        tournament(ctx)

        // Assert
        expect(ctx.keptByAll.map(entry => entry.id)).toEqual(before)
      })
    })
  })

  describe('given a three-way rotation', () => {
    describe('when the pair preferences form a cycle', () => {
      it('then the three entries make one cycle group', () => {
        // Arrange / Act
        const { ctx, sut } = orderOf('A B C', 'B A C', 'A C B')

        // Assert
        expect(sut.cycleGroups.map(g => compact(keysOf(ctx, g)))).toEqual([
          'ABC',
        ])
      })
    })
  })

  describe('given a rotation of three entries', () => {
    describe('when each pair is won against the next', () => {
      it('then the three entries make one cycle group', () => {
        // Arrange / Act
        const { ctx, sut } = orderOf('A B C', 'A C B', 'B A C')

        // Assert
        expect(sut.cycleGroups.map(g => compact(keysOf(ctx, g)))).toEqual([
          'ABC',
        ])
      })
    })
  })

  describe('given a cycle below an undisputed entry', () => {
    describe('when the cut test runs on every prefix', () => {
      it('then only the cycle members are grouped, after the first entry', () => {
        // Arrange / Act
        const { ctx, sut, order } = orderOf('D A B C', 'D B A C', 'D A C B')

        // Assert
        expect(order[0]).toBe('D')
        expect(sut.cycleGroups.map(g => compact(keysOf(ctx, g)))).toEqual([
          'ABC',
        ])
      })
    })
  })
})

describe('cycleMarks', () => {
  describe('given a precedence with a cycle group', () => {
    describe('when marking it', () => {
      it('then every member is joined to the first', () => {
        // Arrange
        const ctx = contextOf('A B C', 'B A C', 'A C B')
        const precedence = tournament(ctx)

        // Act
        const sut = cycleMarks(precedence)

        // Assert
        const [first, second, third] = precedence.cycleGroups[0] as number[]
        expect(sut.joins).toEqual([
          [first, second],
          [first, third],
        ])
      })
    })
  })

  describe('given a precedence without a cycle', () => {
    describe('when marking it', () => {
      it('then nothing is marked', () => {
        // Arrange
        const precedence = tournament(contextOf('A B', 'A B', 'A B'))

        // Act
        const sut = cycleMarks(precedence)

        // Assert
        expect(sut.joins).toEqual([])
        expect(sut.seeds).toEqual([])
      })
    })
  })
})

describe('given generated orderings', () => {
  describe.each(['ancestorPos', 'localPos', 'otherPos'] as const)(
    'when reading the kept entries by %s',
    coordinate => {
      it('then the coordinate is distinct across them', () => {
        fc.assert(
          fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
            // Arrange
            const sut = contextOfCase(generated).keptByAll

            // Act
            const distinct = new Set(sut.map(entry => entry[coordinate]))

            // Assert
            expect(distinct.size).toBe(sut.length)
          })
        )
      })
    }
  )

  describe('when scored by dominance counts', () => {
    it('then every score equals the pairwise reference', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const expected = pairwise.scoresOf(ctx)

          // Act
          const sut = sweepScores(ctx)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })

    it('then an entry standing between two others on a replaced slot scores as the pairwise reference', () => {
      // Arrange
      const ctx = contextOf('A B C D', 'A X C D', 'A B D C')
      const [replacing] = ctx.keptByAll.filter(
        entry => keysOf(ctx, [entry.id])[0] === 'X'
      )
      const expected = pairwise.scoresOf(ctx)

      // Act
      const sut = sweepScores(ctx)

      // Assert
      expect([replacing?.ancestorPos, replacing?.otherPos]).toEqual([1.5, 1.5])
      expect(sut).toEqual(expected)
    })
  })

  describe('when scored pair by pair', () => {
    it('then every score equals the pairwise reference', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const expected = pairwise.scoresOf(ctx)

          // Act
          const sut = pairScores(ctx)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })
  })

  describe('when the tournament runs', () => {
    it('then order, ranks, cycle groups and cycle marks equal the pairwise reference', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const expected = pairwise.tournament(ctx)

          // Act
          const sut = tournament(ctx)

          // Assert
          expect(sut.order.map(entry => entry.id)).toEqual(
            expected.order.map(entry => entry.id)
          )
          expect([...sut.rank]).toEqual([...expected.rank])
          expect(sut.cycleGroups).toEqual(expected.cycleGroups)
          expect(cycleMarks(sut)).toEqual(pairwise.cycleMarks(expected))
        })
      )
    })
  })

  describe('when the tournament runs on a thousand entries moved by other', () => {
    it('then order, ranks and cycle groups equal the pairwise reference', () => {
      // Arrange
      const keys = keyTokens(MANY_KEYS)
      const ancestor = keys.join(' ')
      const other = movedEvery(keys, MOVE_STRIDE, MOVE_SHIFT).join(' ')
      const ctx = contextOf(ancestor, ancestor, other)
      const expected = pairwise.tournament(ctx)

      // Act
      const sut = tournament(ctx)

      // Assert
      expect(sut.order.map(entry => entry.id)).toEqual(
        expected.order.map(entry => entry.id)
      )
      expect([...sut.rank]).toEqual([...expected.rank])
      expect(sut.cycleGroups).toEqual(expected.cycleGroups)
    })
  })

  describe('when reading the entries both sides moved', () => {
    it('then each is an entry both sides kept', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const kept = new Set(ctx.keptByAll.map(entry => entry.id))

          // Act
          const sut = [...ctx.moved.local].filter(id => ctx.moved.other.has(id))

          // Assert
          expect(sut.filter(id => !kept.has(id))).toEqual([])
        })
      )
    })
  })

  describe('when overlaps are joined', () => {
    it('then the classes and the marked entries equal the pairwise reference', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const size = ctx.entries.length
          const expected = seededClasses(pairwise.orderOverlaps(ctx), size)

          // Act
          const sut = seededClasses(orderOverlaps(ctx), size)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })

    it('then pair by pair the classes and the marked entries equal the pairwise reference', () => {
      fc.assert(
        fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
          // Arrange
          const ctx = contextOfCase(generated)
          const size = ctx.entries.length
          const expected = seededClasses(pairwise.orderOverlaps(ctx), size)

          // Act
          const sut = seededClasses(pairOverlaps(ctx), size)

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    })

    it('then both sides moving every fourth of thousands of entries differently gives the pairwise classes and marks', () => {
      // Arrange
      const keys = keyTokens(MANY_KEYS)
      const ancestor = keys.join(' ')
      const local = movedEvery(keys, MOVE_STRIDE, MOVE_SHIFT).join(' ')
      const other = movedEvery(keys, MOVE_STRIDE, OTHER_SHIFT).join(' ')
      const ctx = contextOf(ancestor, local, other)
      const size = ctx.entries.length
      const expected = seededClasses(pairwise.orderOverlaps(ctx), size)

      // Act
      const sut = seededClasses(orderOverlaps(ctx), size)

      // Assert
      expect(sut).toEqual(expected)
    })
  })
})

describe('given thousands of kept entries, every other one moved by other', () => {
  // Counting by dominance takes ~100 ms at SIZE under coverage; scoring pair
  // by pair took ~20 s. The budget sits between the two so that CPU load and
  // coverage instrumentation cannot push the counting code over it.
  const SIZE = 16_000
  const BUDGET_MS = 800
  const QUADRATIC_GUARD_TIMEOUT_MS = 120_000

  describe('when the tournament runs', () => {
    it(
      'then it stays within the budget',
      () => {
        // Arrange
        const keys = keyTokens(SIZE).join(' ')
        const moved = movedEvery(keyTokens(SIZE), MOVE_STRIDE, MOVE_SHIFT)
        const ctx = contextOf(keys, keys, moved.join(' '))

        // Act
        const start = performance.now()
        tournament(ctx)
        const elapsed = performance.now() - start

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )
  })
})

describe('given thousands of kept entries both sides move differently', () => {
  // Joining by component takes tens of milliseconds at SIZE; joining pair by
  // pair takes seconds. The budget sits between the two so that CPU load and
  // coverage instrumentation cannot push the component code over it.
  const SIZE = 16_000
  const BUDGET_MS = 300
  const QUADRATIC_GUARD_TIMEOUT_MS = 120_000

  describe('when the overlaps are joined', () => {
    it(
      'then it stays within the budget',
      () => {
        // Arrange
        const keys = keyTokens(SIZE)
        const local = movedEvery(keys, MOVE_STRIDE, MOVE_SHIFT)
        const other = movedEvery(keys, MOVE_STRIDE, OTHER_SHIFT)
        const ctx = contextOf(keys.join(' '), local.join(' '), other.join(' '))

        // Act
        const start = performance.now()
        orderOverlaps(ctx)
        const elapsed = performance.now() - start

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )
  })
})
