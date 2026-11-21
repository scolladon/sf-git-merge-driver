import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { componentOverlaps } from '../../../../../src/merger/nodes/ordered/overlapComponents.js'
import { pairOverlaps } from '../../../../../src/merger/nodes/ordered/precedence.js'
import { contextOf, seededClasses } from '../../../../utils/orderedContext.js'
import { movedCaseArb } from '../../../../utils/orderedMoves.js'

const MAX_GENERATED_SIZE = 300

describe('componentOverlaps', () => {
  describe('given an entry both sides moved with different partners', () => {
    describe('when joined by component', () => {
      it('then it and its partner form one marked class and nothing else is marked', () => {
        // Arrange
        const ctx = contextOf('A B C D', 'B C A D', 'B A C D')

        // Act
        const sut = componentOverlaps(ctx)

        // Assert
        expect(seededClasses(sut, ctx.entries.length)).toEqual({
          classes: [0, 1, 0, 3],
          marked: [true, false, true, false],
        })
      })
    })
  })

  describe('given both sides flipping it against the same entries', () => {
    describe('when joined by component', () => {
      it('then nothing is joined', () => {
        // Arrange
        const ctx = contextOf('A B C D', 'B A D C', 'B A C D')

        // Act
        const sut = componentOverlaps(ctx)

        // Assert
        expect(sut.joins).toEqual([])
        expect(sut.seeds).toEqual([])
      })
    })
  })

  describe('given entries moved by both sides that a later kept entry is discordant with', () => {
    describe('when joined by component', () => {
      it('then the three share one class', () => {
        // Arrange
        const ctx = contextOf('A B C', 'C B A', 'A C B')

        // Act
        const sut = componentOverlaps(ctx)

        // Assert
        expect(seededClasses(sut, ctx.entries.length)).toEqual({
          classes: [0, 0, 0],
          marked: [true, true, true],
        })
      })
    })
  })

  describe('given generated orderings', () => {
    describe('when joined by component', () => {
      it('then the classes and the marked entries equal the pair by pair ones', () => {
        fc.assert(
          fc.property(movedCaseArb(MAX_GENERATED_SIZE), generated => {
            // Arrange
            const ctx = contextOf(
              generated.ancestor,
              generated.local,
              generated.other
            )
            const size = ctx.entries.length
            const expected = seededClasses(pairOverlaps(ctx), size)

            // Act
            const sut = seededClasses(componentOverlaps(ctx), size)

            // Assert
            expect(sut).toEqual(expected)
          })
        )
      })
    })
  })
})
