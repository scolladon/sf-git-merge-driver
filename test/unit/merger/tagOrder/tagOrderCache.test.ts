import { describe, expect, it, vi } from 'vitest'
import { ContestedTagOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'
import type { PropertyOrder } from '../../../../src/merger/tagOrder/mergePropertyOrder.js'
import { TagOrderCache } from '../../../../src/merger/tagOrder/tagOrderCache.js'

const orderOfNames = (...order: string[]): PropertyOrder => ({
  order,
  blocks: new Map(),
})

describe('TagOrderCache', () => {
  describe('given the same sequences and policy twice', () => {
    it('when asked then it computes once and returns the same order', () => {
      // Arrange
      const sut = new TagOrderCache()
      const compute = vi.fn(() => orderOfNames('a', 'b'))
      const sequences = [
        ['a', 'b'],
        ['b', 'a'],
        ['a', 'b'],
      ]

      // Act
      const first = sut.orderOf(ContestedTagOrder.CONFLICT, sequences, compute)
      const second = sut.orderOf(ContestedTagOrder.CONFLICT, sequences, compute)

      // Assert
      expect(compute).toHaveBeenCalledTimes(1)
      expect(second).toBe(first)
    })
  })

  describe('given sequences that join to the same names in another split', () => {
    it('when asked then each triple has its own order', () => {
      // Arrange
      const sut = new TagOrderCache()
      const compute = vi
        .fn<() => PropertyOrder>()
        .mockReturnValueOnce(orderOfNames('first'))
        .mockReturnValueOnce(orderOfNames('second'))

      // Act
      const first = sut.orderOf(
        ContestedTagOrder.CONFLICT,
        [['a', 'b'], ['c'], []],
        compute
      )
      const second = sut.orderOf(
        ContestedTagOrder.CONFLICT,
        [['a'], ['b', 'c'], []],
        compute
      )

      // Assert
      expect(first.order).toEqual(['first'])
      expect(second.order).toEqual(['second'])
    })
  })

  describe.each([
    ['NUL', '\u0000'],
    ['SOH', '\u0001'],
  ])('given a tag name holding the %s separator character', (_, separator) => {
    it('when asked then it never shares an order with the split names', () => {
      // Arrange
      const sut = new TagOrderCache()
      const compute = vi
        .fn<() => PropertyOrder>()
        .mockReturnValueOnce(orderOfNames('joined'))
        .mockReturnValueOnce(orderOfNames('split'))

      // Act
      const joined = sut.orderOf(
        ContestedTagOrder.CONFLICT,
        [[`a${separator}b`]],
        compute
      )
      const split = sut.orderOf(
        ContestedTagOrder.CONFLICT,
        separator === '\u0000' ? [['a', 'b']] : [['a'], ['b']],
        compute
      )

      // Assert
      expect(joined.order).toEqual(['joined'])
      expect(split.order).toEqual(['split'])
    })
  })

  describe('given the same sequences under another policy', () => {
    it('when asked then the policy has its own order', () => {
      // Arrange
      const sut = new TagOrderCache()
      const sequences = [['a'], ['a'], ['a']]
      const compute = vi
        .fn<() => PropertyOrder>()
        .mockReturnValueOnce(orderOfNames('conflict'))
        .mockReturnValueOnce(orderOfNames('canonical'))

      // Act
      const first = sut.orderOf(ContestedTagOrder.CONFLICT, sequences, compute)
      const second = sut.orderOf(
        ContestedTagOrder.CANONICAL,
        sequences,
        compute
      )

      // Assert
      expect(first.order).toEqual(['conflict'])
      expect(second.order).toEqual(['canonical'])
    })
  })

  describe('given more distinct sequences than it keeps', () => {
    it('when asked past its bound then it still answers, without keeping more', () => {
      // Arrange
      const sut = new TagOrderCache()
      const compute = vi.fn(() => orderOfNames('x'))
      const MAX_CACHED_ORDERS = 1024
      for (let i = 0; i < MAX_CACHED_ORDERS; i++) {
        sut.orderOf(ContestedTagOrder.CONFLICT, [[`t${i}`], [], []], compute)
      }
      compute.mockClear()

      // Act
      sut.orderOf(ContestedTagOrder.CONFLICT, [['overflow'], [], []], compute)
      sut.orderOf(ContestedTagOrder.CONFLICT, [['overflow'], [], []], compute)

      // Assert
      expect(compute).toHaveBeenCalledTimes(2)
    })
  })
})
