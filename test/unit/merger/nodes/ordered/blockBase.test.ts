import { describe, expect, it } from 'vitest'
import {
  attachDeletions,
  type Layout,
} from '../../../../../src/merger/nodes/ordered/blockBase.js'
import type { OrderedContext } from '../../../../../src/merger/nodes/ordered/orderedContext.js'
import { contextOf, keysOf } from '../../../../utils/orderedContext.js'

// A key, or 'K#2' for the second entry of a repeated key; an array is a block.
type Place = string | readonly string[]

const idOf = (ctx: OrderedContext, token: string): number => {
  const [key, occurrence = '1'] = token.split('#')
  const sameKey = ctx.entries.filter(entry => entry.key === key)
  return (sameKey[Number(occurrence) - 1] as { id: number }).id
}

const layoutOf = (ctx: OrderedContext, places: readonly Place[]): Layout => {
  const blockOf = new Map<number, number>()
  const inlineAt = new Map<number, number>()
  const blockPlaces = new Set<number>()
  for (const [place, content] of places.entries()) {
    if (typeof content === 'string') {
      inlineAt.set(idOf(ctx, content), place)
      continue
    }
    blockPlaces.add(place)
    for (const token of content) blockOf.set(idOf(ctx, token), place)
  }
  return { size: places.length, blockOf, inlineAt, blockPlaces }
}

const attachedTo = (
  [ancestor, local, other]: readonly [string, string, string],
  places: readonly Place[]
): Record<number, string[]> => {
  const ctx = contextOf(ancestor, local, other)
  const attached = attachDeletions(ctx, layoutOf(ctx, places))
  return Object.fromEntries(
    [...attached].map(([place, ids]) => [place, [...keysOf(ctx, ids)]])
  )
}

const PZQ: readonly [string, string, string] = ['P Z Q', 'P Q', 'P Q']

describe('attachDeletions', () => {
  describe('given an entry both sides deleted', () => {
    describe('when a neighbour in the base sits in a block', () => {
      it.each([
        ['the previous one', PZQ, [['P'], 'Q'], { 0: ['Z'] }],
        [
          'the next one when the previous is outside',
          PZQ,
          ['P', ['Q']],
          { 1: ['Z'] },
        ],
        [
          'the previous live one, not an inserted entry',
          ['Z P', 'P X', 'P'],
          ['P', ['X']],
          {},
        ],
        [
          'the previous one in base order, not in entry order',
          ['A B A', 'A B', 'A B'],
          [['A'], 'B'],
          {},
        ],
      ] as const)(
        'then it joins the block of %s',
        (_title, sides, places, expected) => {
          // Arrange
          const sut = attachedTo

          // Act
          const result = sut(sides, places)

          // Assert
          expect(result).toEqual(expected)
        }
      )
    })

    describe('when no neighbour sits in a block', () => {
      it.each([
        ['between its neighbours', PZQ, ['P', [], 'Q'], { 1: ['Z'] }],
        [
          'between its neighbours in the merged order',
          PZQ,
          ['Q', [], 'P'],
          { 1: ['Z'] },
        ],
        [
          'after the last block among several',
          PZQ,
          [[], 'P', [], 'Q'],
          { 2: ['Z'] },
        ],
        [
          'at the start of the base',
          ['Z P', 'P', 'P'],
          [[], 'P'],
          { 0: ['Z'] },
        ],
        ['at the end of the base', ['P Z', 'P', 'P'], ['P', []], { 1: ['Z'] }],
        [
          'with another deleted entry next to it and a block elsewhere',
          ['P Z Y Q', 'P Q', 'P Q'],
          [[], 'P', 'Q'],
          {},
        ],
        ['with no block in between', PZQ, ['P', 'Q', []], {}],
        [
          'with no block before the first neighbour',
          ['Z P', 'P', 'P'],
          ['P', []],
          {},
        ],
        ['with no block at all', PZQ, ['P', 'Q'], {}],
      ] as const)(
        'then it is attached %s',
        (_title, sides, places, expected) => {
          // Arrange
          const sut = attachedTo

          // Act
          const result = sut(sides, places)

          // Assert
          expect(result).toEqual(expected)
        }
      )
    })
  })
})
