import { describe, expect, it } from 'vitest'
import {
  cycleMarks,
  orderOverlaps,
  tournament,
} from '../../../../../src/merger/nodes/ordered/precedence.js'
import { contextOf, keysOf } from '../../../../utils/orderedContext.js'

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
