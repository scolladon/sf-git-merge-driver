import { describe, expect, it } from 'vitest'
import { placeAgreedInsertions } from '../../../../../src/merger/nodes/ordered/placement.js'
import { tournament } from '../../../../../src/merger/nodes/ordered/precedence.js'
import { contextOf, keysOf } from '../../../../utils/orderedContext.js'

const placementOf = (ancestor: string, local: string, other: string) => {
  const ctx = contextOf(ancestor, local, other)
  const sut = placeAgreedInsertions(ctx, tournament(ctx))
  const idOf = (key: string) =>
    ctx.entries.find(entry => entry.key === key)?.id as number
  return { ctx, sut, idOf }
}

const compact = (keys: readonly string[]): string => keys.join('')

const spineOf = (placement: ReturnType<typeof placementOf>): string =>
  compact(
    keysOf(
      placement.ctx,
      placement.sut.spine.entries.map(entry => entry.id)
    )
  )

const joinedOf = (placement: ReturnType<typeof placementOf>): string[] =>
  [
    ...new Set(
      placement.sut.marks.joins.map(join =>
        compact(keysOf(placement.ctx, join).slice().sort())
      )
    ),
  ].sort()

const rawJoinsOf = (placement: ReturnType<typeof placementOf>): string =>
  placement.sut.marks.joins
    .map(join => compact(keysOf(placement.ctx, join).slice().sort()))
    .sort()
    .join(',')

describe('placeAgreedInsertions', () => {
  describe('given entries both sides inserted in agreement with the shared ones', () => {
    describe('when placing them', () => {
      it.each([
        ['A B C D', 'A X Y Z D', 'A X W Z D', 'AXZD'],
        ['A B C', 'A B A* C X', 'A B A* C*', 'ABAC'],
        ['A B', 'B A X', 'A B X Y', 'BAX'],
        ['A B C', 'A X Y B C', 'A X Y B C D', 'AXYBC'],
        ['A B C', 'X A B C', 'X A B C D', 'XABC'],
      ])('then %s / %s / %s spans %s without marks', (a, l, o, spine) => {
        // Arrange
        const placement = placementOf(a, l, o)

        // Act
        const { sut } = placement

        // Assert
        expect(spineOf(placement)).toBe(spine)
        expect(sut.marks).toEqual({ joins: [], seeds: [] })
      })
    })
  })

  describe('given an insertion placed differently next to a shared entry', () => {
    describe('when both sides keep them adjacent', () => {
      it('then the two are joined as disputed', () => {
        // Arrange
        const placement = placementOf('A B C', 'A X B C', 'A B X C')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('ABXC')
        expect(joined).toEqual(['BX'])
      })
    })
  })

  describe('given two insertions ordered oppositely by adjacent sides', () => {
    describe('when relating them to each other', () => {
      it('then the two are joined as disputed', () => {
        // Arrange
        const placement = placementOf('A B C', 'A X Y B C', 'A Y X B C')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('AXYBC')
        expect(joined).toEqual(['XY'])
      })
    })
  })

  describe('given an insertion bounded by a moved entry', () => {
    describe('when its bounds cross', () => {
      it('then it is joined with every entry of the crossed ranks', () => {
        // Arrange
        const placement = placementOf('A B C', 'C A B X', 'A B X C')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('CABX')
        expect(joined).toEqual(['AX', 'BX', 'CX'])
      })
    })
  })

  describe('given insertions bounded inside a cycle of shared entries', () => {
    describe('when the bounds cross', () => {
      it('then the insertions are joined with each other and the cycle', () => {
        // Arrange
        const placement = placementOf('A B C', 'A Y X C B', 'B Y X C A')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('CBAYX')
        expect(joined).toEqual(['AX', 'AY', 'BX', 'BY', 'CX', 'CY', 'XY'])
      })
    })
  })

  describe('given a relation the slot order contradicts', () => {
    describe('when the insertions sit in one cyclic slot', () => {
      it('then the contradicted insertion is joined with itself', () => {
        // Arrange
        const placement = placementOf('A B C', 'Y A C X B', 'X Y C A B')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('CYXAB')
        expect(joined).toEqual(['CX', 'CY', 'XX', 'XY'])
      })
    })
  })

  describe('given an insertion no shared entry orders against another', () => {
    describe('when neither reaches the other', () => {
      it('then the two are joined as unordered', () => {
        // Arrange
        const placement = placementOf('A B C', 'B C Y A', 'C Y A B')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('CBYA')
        expect(joined).toEqual(['BY'])
      })
    })
  })

  describe('given several insertions of one slot where only a later one is unreached', () => {
    describe('when emitting the slot', () => {
      it('then the unreached insertion comes first', () => {
        // Arrange
        const placement = placementOf('A B', 'Y W X Z B A', 'W B Y A Z X')

        // Act
        const joined = joinedOf(placement)

        // Assert
        expect(spineOf(placement)).toBe('BAYWZX')
        expect(joined).toEqual(['AZ', 'BW', 'BY', 'BZ', 'WY', 'WZ', 'XZ', 'YZ'])
      })
    })
  })

  describe('given sides inserting entries around shared ones', () => {
    describe('when placing the agreed insertions', () => {
      it.each([
        ['A', 'Z Y A X', 'X Y Z A', 'ZAYX', 'AX,AY,XX,XY,XY,YZ'],
        [
          'A',
          'A W Y T V X Z',
          'T V Z X Y W',
          'WYTVXZ',
          'TV,TW,TW,TW,TX,TX,TY,VW,VW,VW,VX,VX,VY,WX,WX,WX,WY,WY,WY,WY,WZ,WZ,WZ,XX,XY,XY,XZ',
        ],
        [
          'A B C D',
          'D Z X B Y C',
          'D X C Y Z A',
          'DZXYC',
          'CY,XY,XY,XZ,YY,YZ,YZ',
        ],
        ['A B C D E', 'B A E X C', 'C B D E X A', 'BCEXA', 'BX,CX,EX'],
        ['A', 'A B A', 'A A B', 'ABA', 'AB,AB,AB,AB'],
        ['A B', 'X A B', 'A X B', 'AXB', 'AX,AX'],
        ['A B', 'A B X', 'B X A', 'BXA', ''],
        ['A B', 'A X B', 'X B A', 'BAX', 'AX,BX'],
        ['A B', 'X A B', 'A B X', 'ABX', 'AX,BX'],
        ['A B', 'A X B', 'A B X', 'ABX', 'BX,BX'],
        ['A B', 'B Y A', 'B A Y', 'BAY', 'AY,AY'],
        ['A B', 'X B A', 'X A B', 'XBA', ''],
        ['A B', 'B X A', 'X B A', 'BXA', 'BX,BX'],
        ['A B', 'B A X', 'B X A', 'BAX', 'AX,AX'],
        ['A B', 'B X A', 'A X B', 'BAX', 'AX,AX,BX,BX'],
        ['A B', 'Y A B', 'B Y A', 'BYA', ''],
        ['A B', 'A B Y', 'B A Y', 'BAY', ''],
        ['A B', 'A Y B', 'Y A B', 'AYB', 'AY,AY'],
        ['A B', 'A Y B', 'A B Y', 'ABY', 'BY,BY'],
        ['A B', 'A B Y', 'Y B A', 'BAY', 'AY,BY,BY'],
        ['A B', 'B A X', 'A B X', 'BAX', ''],
        ['A B', 'X Z A B', 'Z X A', 'XZA', 'XZ,XZ,XZ,XZ'],
        ['A B', 'B A Y X', 'Y B X', 'BYX', 'BY,BY'],
        ['A B C', 'X B Y', 'B X Y', 'BXY', 'BX,BX'],
        ['A B', 'A X Y', 'X Y A B', 'AXY', 'AX,AY,XY'],
        ['A B', 'B Y X', 'Y A X B', 'BYX', 'BX,BY,XY'],
        ['A B C', 'C A B', 'B C A', 'CBA', ''],
        ['A B', 'B Z A Y', 'Z B Y', 'BZY', 'BZ,BZ'],
        ['A B', 'X Y A', 'Y X B A', 'XYA', 'XY,XY,XY,XY'],
        ['A B', 'A Y X', 'X Y A B', 'AYX', 'AX,AY,AY,XY,XY,XY,XY'],
        ['A B', 'B X Y', 'X Y A B', 'BXY', 'BX,BY,XY'],
        ['A B', 'B X Y', 'B X Y A', 'BXY', ''],
        ['A B', 'A Y X', 'Y A X B', 'AYX', 'AY,AY'],
        ['A B', 'Y X A B', 'X Y B', 'YXB', 'XY,XY,XY,XY'],
        ['A B', 'Y X A', 'X B A Y', 'AYX', 'AX,AY,XY'],
        ['A B', 'A X Y', 'A X Y B', 'AXY', ''],
        ['A B', 'X A Y', 'B Y X A', 'AXY', 'AX,AY,XY,XY,YY'],
        ['A B', 'B Y X', 'A B X Y', 'BYX', 'XY,XY,XY,XY'],
        ['A B', 'Y X B', 'B A X Y', 'BYX', 'BX,BX,BY,XY,XY,XY,XY'],
        ['A B', 'Y A B X', 'Y X B', 'YBX', 'BX,BX'],
        ['A B', 'Y B A X', 'B X A Y', 'BAYX', 'AX,AY,BY'],
        ['A B', 'X V B A', 'X A B V', 'XBAV', 'AV,BV,BV'],
        ['A B', 'Y B A X', 'X A Y B', 'BAYX', 'AX,AX,AY,BX,BY,XY,XY,XY'],
        ['A B C', 'X C A B', 'B A X', 'BAX', 'AX,AX,BX'],
        ['A B C', 'A X C B', 'A C X', 'ACX', 'CX,CX'],
        ['A B C', 'C A B X', 'C A X', 'CAX', ''],
        ['A B', 'A X B Y', 'X Y A B', 'ABXY', 'AX,AY,BY,XY'],
        ['A B', 'A Y X B', 'Y B A X', 'BAYX', 'AX,AY,BX,BY,XY'],
        ['A B', 'A Z B Y', 'B Z A Y', 'BAZY', 'AZ,AZ,BZ,BZ'],
        ['A B C', 'C B Y', 'B Y C A', 'CBY', 'BY,CY'],
        [
          'A C E',
          'A E x1 x3 x5 x2 C',
          'x2 C x5 x3 x1 A E',
          'ACEx1x3x5x2',
          'Ax1,Ax2,Ax3,Ax5,Cx1,Cx2,Cx3,Cx5,Ex1,Ex2,Ex3,Ex5,x1x2,x1x3,x1x3,x1x3,x1x3,x1x5,x2x3,x2x3,x2x3,x2x5,x3x5,x3x5,x3x5,x3x5',
        ],
        [
          '',
          'x1 x3 x2 x0',
          'x0 x2 x1 x3',
          'x1x3x2x0',
          'x0x1,x0x1,x0x1,x0x2,x0x2,x0x2,x0x2,x0x3,x0x3,x0x3,x1x2,x1x2,x1x3,x2x2,x2x3,x2x3',
        ],
        [
          '',
          'x1 x3 x4 x2 x0',
          'x0 x2 x3 x1 x4',
          'x1x3x4x2x0',
          'x0x1,x0x1,x0x1,x0x2,x0x2,x0x2,x0x2,x0x3,x0x3,x0x3,x0x4,x0x4,x0x4,x1x3,x2x2,x2x3,x2x3,x2x4,x2x4,x3x4',
        ],
        [
          'A B',
          'A x4 x1 x3 x0 B x2',
          'x0 A x3 x2 x1 x4 B',
          'Ax4Bx1x3x0x2',
          'Ax0,Ax3,Bx1,Bx2,x0x1,x0x2,x0x2,x0x3,x1x2,x1x2,x1x3,x1x4,x2x2,x2x3,x2x3',
        ],
      ])(
        'then %s / %s / %s spans %s with joins [%s]',
        (a, l, o, spine, joins) => {
          // Arrange
          const placement = placementOf(a, l, o)

          // Act
          const sut = placement.sut

          // Assert
          expect(spineOf(placement)).toBe(spine)
          expect(rawJoinsOf(placement)).toBe(joins)
          expect([...sut.spine.rank.values()]).toEqual(
            sut.spine.entries.map((_, index) => index)
          )
        }
      )
    })
  })

  describe('given agreed insertions written in another order than their ids', () => {
    describe('when placing them', () => {
      it('then the context keeps its own agreed order', () => {
        // Arrange
        const ctx = contextOf('A', 'A B A', 'A A B')
        const before = ctx.agreed.map(entry => entry.id)

        // Act
        placeAgreedInsertions(ctx, tournament(ctx))

        // Assert
        expect(ctx.agreed.map(entry => entry.id)).toEqual(before)
      })
    })
  })

  describe('given the spine', () => {
    describe('when asking for ranks', () => {
      it('then each spine entry has its spine index', () => {
        // Arrange
        const { sut, idOf } = placementOf('A B C D', 'A X Y Z D', 'A X W Z D')

        // Act
        const ranks = ['A', 'X', 'Z', 'D'].map(key =>
          sut.spine.rank.get(idOf(key))
        )

        // Assert
        expect(ranks).toEqual([0, 1, 2, 3])
        expect(sut.marks.joins).toEqual([])
      })
    })
  })

  describe('given an insertion after a cycle of shared entries', () => {
    describe('when the entries of the cycle reach each other', () => {
      it('then the insertion follows the whole cycle and nothing is joined', () => {
        // Arrange
        const placement = placementOf('A B C', 'B A C X', 'A C B X')
        const { sut, idOf } = placement

        // Act
        const ranks = ['A', 'B', 'C', 'X'].map(key =>
          sut.spine.rank.get(idOf(key))
        )

        // Assert
        expect(spineOf(placement)).toBe('ABCX')
        expect(ranks).toEqual([0, 1, 2, 3])
        expect(sut.marks.joins).toEqual([])
      })
    })
  })

  describe('given insertions caught in precedence cycles of several entries', () => {
    describe('when placing them', () => {
      // Found by random search: each input changes the placement if a cycle
      // stands for one of its members only, or for one member of either end.
      it.each([
        [
          'B F',
          'x3 x0 x4 x5 B F x1',
          'B x4 x5 x1 x0 x3 F',
          'B x3 F x0 x4 x5 x1',
          'x3-x0,x0-F,x4-B,x5-B,x1-F,x0-x4,x0-x5,x0-x1,x4-x5,x4-x1,x5-x1,x1-x0,x1-x4,x1-x5,x1-x1',
        ],
        [
          'B C',
          'B x3 x1 x5 x6 C x4',
          'x6 B x5 C x4 x1 x3',
          'B C x1 x5 x6 x4 x3',
          'x3-x1,x1-C,x5-B,x6-B,x4-C,x1-x5,x1-x6,x1-x4,x5-x6,x5-x4,x6-x4,x4-x1,x4-x5,x4-x6,x4-x4',
        ],
      ])('then %s / %s / %s spans %s', (a, l, o, spine, joins) => {
        // Arrange
        const ctx = contextOf(a, l, o)

        // Act
        const sut = placeAgreedInsertions(ctx, tournament(ctx))

        // Assert
        expect(
          keysOf(
            ctx,
            sut.spine.entries.map(entry => entry.id)
          ).join(' ')
        ).toBe(spine)
        expect(
          sut.marks.joins.map(join => keysOf(ctx, join).join('-')).join(',')
        ).toBe(joins)
      })
    })
  })

  describe('given a thousand insertions both sides added in one slot', () => {
    describe('when placing them', () => {
      // The cubic placement needs minutes for this size; a loaded machine
      // slows the quadratic one by a small factor, never by that much.
      const SLOT_TIME_BOUND_MS = 6_000
      const INSERTIONS = 1000
      const insertions = Array.from({ length: INSERTIONS }, (_, at) => `x${at}`)

      it('then the placement takes far less than the bound and keeps their order', {
        timeout: 2 * SLOT_TIME_BOUND_MS,
      }, () => {
        // Arrange
        const written = ['A', ...insertions].join(' ')
        const ctx = contextOf('A', written, written)

        // Act
        const started = performance.now()
        const sut = placeAgreedInsertions(ctx, tournament(ctx))
        const elapsed = performance.now() - started

        // Assert
        expect(elapsed).toBeLessThan(SLOT_TIME_BOUND_MS)
        expect(
          keysOf(
            ctx,
            sut.spine.entries.map(entry => entry.id)
          )
        ).toEqual(['A', ...insertions])
        expect(sut.marks.joins).toEqual([])
      })
    })
  })
})
