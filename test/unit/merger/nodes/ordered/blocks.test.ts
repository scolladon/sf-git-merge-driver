import { describe, expect, it } from 'vitest'
import {
  buildBlocks,
  type OrderedItem,
} from '../../../../../src/merger/nodes/ordered/blocks.js'
import { ConflictSeeds } from '../../../../../src/merger/nodes/ordered/conflictSeeds.js'
import { placeOneSided } from '../../../../../src/merger/nodes/ordered/oneSidedPlacement.js'
import type { OrderedContext } from '../../../../../src/merger/nodes/ordered/orderedContext.js'
import { placeAgreedInsertions } from '../../../../../src/merger/nodes/ordered/placement.js'
import {
  cycleMarks,
  orderOverlaps,
  tournament,
} from '../../../../../src/merger/nodes/ordered/precedence.js'
import type { JsonObject } from '../../../../../src/types/jsonTypes.js'
import { contextOf } from '../../../../utils/orderedContext.js'
import { ORDERED_ATTRIBUTE } from '../../../../utils/orderedTokens.js'

const EMPTY_SIDE = '∅'
const LARGE_SIZE = 4000
// Linear building takes ~20 ms at LARGE_SIZE under coverage; settling the
// closure once per seed takes ~13 s. The bound sits between the two so that
// CPU load and coverage instrumentation cannot push the linear code over it.
const MAX_CLOSURE_MS = 1000
const LARGE_TIMEOUT_MS = 120_000

const labelOfValue = (value: JsonObject | undefined): string =>
  (value as { label: string }).label

type Side = 'ancestor' | 'local' | 'other'

const labelOn = (ctx: OrderedContext, id: number, side: Side): string =>
  labelOfValue(ctx.entries[id]![side])

const inlineLabel = (ctx: OrderedContext, id: number): string => {
  const status = ctx.statuses[id]!
  if (status.kind !== 'clean') return labelOn(ctx, id, 'local')
  const [wrapper] = status.output as JsonObject[]
  return labelOfValue(wrapper![ORDERED_ATTRIBUTE] as JsonObject)
}

const sideLabel = (
  ctx: OrderedContext,
  ids: readonly number[],
  side: Side
): string =>
  ids.length === 0
    ? EMPTY_SIDE
    : ids.map(id => labelOn(ctx, id, side)).join(',')

const formatItem = (ctx: OrderedContext, item: OrderedItem): string => {
  if ('entry' in item) return inlineLabel(ctx, item.entry)
  const { local, ancestor, other } = item.block
  return `<${[
    sideLabel(ctx, local, 'local'),
    sideLabel(ctx, ancestor, 'ancestor'),
    sideLabel(ctx, other, 'other'),
  ].join(' | ')}>`
}

const idOf = (ctx: OrderedContext, key: string): number =>
  ctx.entries.findIndex(entry => entry.key === key)

const pipelineOf = (
  ancestor: string,
  local: string,
  other: string,
  joined: readonly string[] = []
) => {
  const ctx = contextOf(ancestor, local, other)
  const precedence = tournament(ctx)
  const agreed = placeAgreedInsertions(ctx, precedence)
  const oneSided = placeOneSided(ctx, agreed.spine)
  const seeds = new ConflictSeeds(ctx.entries.length)
  for (const marks of [
    orderOverlaps(ctx),
    cycleMarks(precedence),
    agreed.marks,
    oneSided.marks,
  ]) {
    seeds.apply(marks)
  }
  const presence = ctx.statuses
    .map((status, id) => (status.kind === 'presenceConflict' ? id : -1))
    .filter(id => id >= 0)
  seeds.apply({ joins: [], seeds: presence })
  const [first, ...rest] = joined.map(key => idOf(ctx, key))
  for (const id of rest) seeds.join(first as number, id)
  return { ctx, output: oneSided.output, seeds }
}

const closedBy = (
  [ancestor, local, other]: readonly [string, string, string],
  outputKeys: readonly string[],
  groups: readonly (readonly string[])[]
): string => {
  const ctx = contextOf(ancestor, local, other)
  const seeds = new ConflictSeeds(ctx.entries.length)
  for (const group of groups) {
    const [first, ...rest] = group.map(key => idOf(ctx, key))
    seeds.apply({ joins: [], seeds: [first as number] })
    for (const id of rest) seeds.join(first as number, id)
  }
  const output = outputKeys.map(key => idOf(ctx, key))
  return buildBlocks(ctx, output, seeds)
    .map(item => formatItem(ctx, item))
    .join(',')
}

const blocksOf = (
  ancestor: string,
  local: string,
  other: string,
  joined: readonly string[] = []
): string => {
  const { ctx, output, seeds } = pipelineOf(ancestor, local, other, joined)
  return buildBlocks(ctx, output, seeds)
    .map(item => formatItem(ctx, item))
    .join(',')
}

describe('buildBlocks', () => {
  describe('given entries both sides inserted into one gap', () => {
    describe('when closing the conflict', () => {
      it('then the insertions form one block between the shared entries', () => {
        // Arrange
        const [ancestor, local, other] = ['K B', 'B X K', 'B Y K']

        // Act
        const sut = blocksOf(ancestor!, local!, other!)

        // Assert
        expect(sut).toBe('B,<X | ∅ | Y>,K')
      })
    })
  })

  describe('given conflicts the pipeline marks', () => {
    describe('when closing them', () => {
      it.each([
        [
          'replaced pair, base kept by region',
          'A B C D',
          'A X Y Z D',
          'A X W Z D',
          'A,X,<Y | B,C | W>,Z,D',
        ],
        [
          'deleted by both attached to the block',
          'K B D',
          'B X K',
          'B Y K',
          'B,<X | D | Y>,K',
        ],
        [
          'deleted by both between two blocks',
          'A B C Z D E F',
          'A X B C D Y E F',
          'A B X C D E Y F',
          'A,<X,B | B | B,X>,C,D,<Y,E | E | E,Y>,F',
        ],
        [
          'one entry inserted at two places',
          'A B C',
          'A X B C',
          'A B X C',
          'A,<X,B | B | B,X>,C',
        ],
        [
          'same entry added at two places',
          'A C',
          'A B C',
          'A C B',
          'A,<B,C | C | C,B>',
        ],
        [
          'deleted by one side and moved by the other',
          'C D',
          'D C',
          'C*',
          '<D | D | ∅>,C*',
        ],
        [
          'deleted and moved ahead of a deleted neighbour',
          'A B C',
          'C A',
          'C',
          'C,<A | A,B | ∅>',
        ],
        ['replacement', 'A B', 'X', 'A Y B', '<X | A,B | Y>'],
        ['common head outside the markers', 'A', 'A X', 'X Y', 'X,<∅ | A | Y>'],
        [
          'common tail of both sides outside the markers',
          'A',
          'X A',
          'Y X',
          '<∅ | A | Y>,X',
        ],
        [
          'common tail outside the markers',
          'A B C',
          'X Y B',
          'A X B',
          'X,<Y | A | ∅>,B',
        ],
        [
          'moves whose spans interleave',
          'A C X Y',
          'C D Y A',
          'Y A C',
          '<C,D,Y,A | A,C,X,Y | Y,A,C>',
        ],
      ])('then %s gives the smallest blocks', (_title, a, l, o, expected) => {
        // Arrange
        const sut = blocksOf

        // Act
        const result = sut(a, l, o)

        // Assert
        expect(result).toBe(expected)
      })
    })
  })

  describe('given a block with an entry whose fields conflict at its end', () => {
    describe('when both sides share that entry', () => {
      it('then the entry stays inside the markers', () => {
        // Arrange
        const [ancestor, local, other] = ['A B C', 'A X B C*', 'A B X C+']

        // Act
        const sut = blocksOf(ancestor!, local!, other!, ['X', 'C'])

        // Assert
        expect(sut).toBe('A,<X,B,C* | B,C | B,X,C+>')
      })
    })
  })

  describe('given thousands of entries with a conflict in every gap', () => {
    describe('when closing the conflicts', () => {
      it(
        'then it stays near-linear',
        () => {
          // Arrange
          const keys = Array.from({ length: LARGE_SIZE }, (_, i) => `A${i}`)
          const withInsertions = (prefix: string) =>
            keys.flatMap((key, i) => [key, `${prefix}${i}`]).join(' ')
          const { ctx, output, seeds } = pipelineOf(
            keys.join(' '),
            withInsertions('X'),
            withInsertions('Y')
          )
          const started = performance.now()

          // Act
          const sut = buildBlocks(ctx, output, seeds)

          // Assert
          expect(sut).toHaveLength(LARGE_SIZE * 2)
          expect(performance.now() - started).toBeLessThan(MAX_CLOSURE_MS)
        },
        LARGE_TIMEOUT_MS
      )
    })
  })

  describe('given seeded entries with other entries around them', () => {
    describe('when closing the blocks', () => {
      const CONFLICTING: readonly [string, string, string] = [
        'A B C D',
        'A* X B C D* Y',
        'A+ B C D+',
      ]
      const OUTPUT = ['A', 'X', 'B', 'C', 'D', 'Y']
      it.each([
        [
          'a gap between joined entries',
          CONFLICTING,
          OUTPUT,
          [['A', 'X', 'D', 'Y']],
          '<A*,X,B,C,D*,Y | A,B,C,D | A+,B,C,D+>',
        ],
        [
          'blocks touching in the output',
          CONFLICTING,
          OUTPUT,
          [
            ['A', 'X', 'B'],
            ['C', 'D', 'Y'],
          ],
          '<A*,X,B,C,D*,Y | A,B,C,D | A+,B,C,D+>',
        ],
        [
          'blocks apart in the output',
          CONFLICTING,
          OUTPUT,
          [
            ['A', 'X'],
            ['D', 'Y'],
          ],
          '<A*,X | A | A+>,B,C,<D*,Y | D | D+>',
        ],
        [
          'blocks that only touch once merged',
          ['A D', 'A* N D*', 'A+ D+'],
          ['A', 'D', 'N'],
          [['A'], ['D']],
          '<A*,N,D* | A,D | A+,D+>',
        ],
        [
          'growth that needs another pass',
          ['A B X', 'A* B* Y X*', 'A+ X+ B+'],
          ['A', 'B', 'Y', 'X'],
          [['A', 'B']],
          '<A*,B*,Y,X* | A,B,X | A+,X+,B+>',
        ],
        [
          'blocks interleaved on a side only',
          ['A B C', 'A* B* C*', 'A+ C+ N B+'],
          ['A', 'C', 'N', 'B'],
          [['A', 'C'], ['B']],
          '<A*,B*,C* | A,B,C | A+,C+,N,B+>',
        ],
        [
          'an entry before the first block',
          ['B C', 'W B C*', 'B C+ V'],
          ['W', 'B', 'C', 'V'],
          [['C', 'V']],
          'W,B,<C* | C | C+,V>',
        ],
        [
          'one side a prefix of the other',
          ['A', 'A*', 'A+ B'],
          ['A', 'B'],
          [['A', 'B']],
          '<A* | A | A+,B>',
        ],
      ] as const)(
        'then %s gives the smallest blocks',
        (_title, sides, output, groups, expected) => {
          // Arrange
          const sut = closedBy

          // Act
          const result = sut(sides, output, groups)

          // Assert
          expect(result).toBe(expected)
        }
      )
    })
  })
})
