import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { collapsibleKeys } from '../../../../../src/merger/nodes/ordered/collapsible.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import { jsonIdentical } from '../../../../../src/utils/jsonEqual.js'
import {
  type Case,
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
  SMALL,
  SMALL_ANCESTORS,
} from '../../../../utils/orderedCases.js'
import {
  cutCaseArb,
  groupCaseArb,
  LAYOUT_SHAPES,
  layoutSides,
} from '../../../../utils/orderedCuts.js'
import {
  orderedSides,
  REORDERED_MARK,
} from '../../../../utils/orderedTokens.js'

vi.mock('../../../../../src/utils/jsonEqual.js', async importOriginal => {
  const original =
    await importOriginal<
      typeof import('../../../../../src/utils/jsonEqual.js')
    >()
  return { ...original, jsonIdentical: vi.fn(original.jsonIdentical) }
})

type Row = readonly [
  name: string,
  ancestor: string,
  local: string,
  other: string,
  expected: readonly string[],
]

const ACCEPTED_ROWS: readonly Row[] = [
  [
    'an insertion on the keeping side after the copies',
    'K K U',
    'K U',
    'K K Z U',
    ['K'],
  ],
  [
    'an interchangeable neighbour the keeping side drops whole',
    'K K J J U',
    'K J J U',
    'K K Z U',
    ['J', 'K'],
  ],
  ['keyless copies', '~a ~a B', '~a B', '~a ~a B', ['~a']],
  [
    'a neighbour the keeping side writes with its fields reordered',
    'K K U',
    'K U',
    'K K U^',
    ['K'],
  ],
  [
    'a key held once edited on a side next to the copies',
    'K K U',
    'K U*',
    'K K U',
    ['K'],
  ],
]

const REFUSED_BY_THE_COPIES_ROWS: readonly Row[] = [
  ['keys held once on every side', 'A B', 'A B', 'A B C', []],
  ['an insertion between the copies', 'A A', 'A', 'A X A', []],
  [
    'a dropped copy whose twin lists its fields in another order',
    'K K U',
    'K U',
    'K^ K U',
    [],
  ],
  ['a kept copy edited', 'K K U', 'K* U', 'K K U', []],
  ['a side adding a copy', 'K K U', 'K K K U', 'K U', []],
  ['both sides dropping copies', 'K K K U', 'K U', 'K K U', []],
  ['a repeated key with one copy reordered', 'K K U', 'K U', 'K^ K U', []],
]

// Edit marks stay at the end of a renamed token: 'K*' becomes 'RK*'
const relabelled = (token: string): string =>
  token.startsWith(KEYLESS_PREFIX)
    ? `${KEYLESS_RELABEL_PREFIX}${token.slice(KEYLESS_PREFIX.length)}`
    : `${RELABEL_PREFIX}${token}`

const LAYOUT_COPIES = [2, 3]
const LAYOUT_GADGETS = [1, 2, 3, 4]

const GENERATED_CASES: readonly (readonly [string, fc.Arbitrary<Case>])[] = [
  [
    'repeated keyed and keyless keys',
    caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  ],
  ['few repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
  [
    'parts joined by unique keys',
    cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  ],
  ['spans of identical copies one side drops', groupCaseArb],
]

// A key held twice on one side has copies a reading can exchange
const REPEATED_COPIES = 2
const MOST_DROPPING_SIDES = 1
const KEYLESS_PREFIX = '~'
const RELABEL_PREFIX = 'R'
const KEYLESS_RELABEL_PREFIX = '~r'
// Sampled with the global seed: the sampled cases hold an interchangeable key
// in about a third of them and a reordered copy in about three in five
const REACH_RUNS = 100
const MIN_INTERCHANGEABLE = 20
const MIN_REORDERED = 40

type SideName = 'ancestor' | 'local' | 'other'
const SIDE_NAMES: readonly SideName[] = ['ancestor', 'local', 'other']
const LIVE_SIDE_NAMES: readonly SideName[] = ['local', 'other']

// The definition read straight off its statement, sharing nothing with the
// code under test
const positionsOn = (
  sides: OrderedSides,
  side: SideName,
  wanted: string
): number[] =>
  sides.keys[side].flatMap((key, at) => (key === wanted ? [at] : []))

const countOn = (sides: OrderedSides, side: SideName, key: string): number =>
  positionsOn(sides, side, key).length

const copiesOf = (sides: OrderedSides, key: string): unknown[] =>
  SIDE_NAMES.flatMap(side =>
    positionsOn(sides, side, key).map(at => sides[side][at])
  )

const isRepeatedByDefinition = (sides: OrderedSides, key: string): boolean =>
  SIDE_NAMES.some(side => countOn(sides, side, key) >= REPEATED_COPIES)

const isIdentical = (sides: OrderedSides, key: string): boolean => {
  const copies = copiesOf(sides, key)
  return copies.every(copy => jsonIdentical(copy, copies[0]))
}

const isConsecutive = (sides: OrderedSides, key: string): boolean =>
  SIDE_NAMES.every(side => {
    const positions = positionsOn(sides, side, key)
    return positions.every((at, index) => at === positions[0] + index)
  })

const droppersOf = (sides: OrderedSides, key: string): SideName[] =>
  LIVE_SIDE_NAMES.filter(
    side => countOn(sides, side, key) < countOn(sides, 'ancestor', key)
  )

const isCoreByDefinition = (sides: OrderedSides, key: string): boolean =>
  isIdentical(sides, key) &&
  isConsecutive(sides, key) &&
  LIVE_SIDE_NAMES.every(
    side => countOn(sides, side, key) <= countOn(sides, 'ancestor', key)
  ) &&
  droppersOf(sides, key).length <= MOST_DROPPING_SIDES

const neighboursOf = (
  sides: OrderedSides,
  side: SideName,
  key: string
): string[] => {
  const positions = positionsOn(sides, side, key)
  if (positions.length === 0) return []
  return [positions[0] - 1, positions[positions.length - 1] + 1]
    .filter(at => at >= 0 && at < sides.keys[side].length)
    .map(at => sides.keys[side][at])
}

const isQuietNeighbour = (
  sides: OrderedSides,
  key: string,
  side: SideName,
  neighbour: string
): boolean => {
  const inserted =
    countOn(sides, side, neighbour) > countOn(sides, 'ancestor', neighbour)
  const dropped = LIVE_SIDE_NAMES.some(
    live =>
      countOn(sides, live, neighbour) < countOn(sides, 'ancestor', neighbour)
  )
  const exempt =
    isRepeatedByDefinition(sides, neighbour) &&
    isCoreByDefinition(sides, neighbour)
  return (
    exempt || (!(droppersOf(sides, key).includes(side) && inserted) && !dropped)
  )
}

const isQuietByDefinition = (sides: OrderedSides, key: string): boolean =>
  SIDE_NAMES.every(side =>
    neighboursOf(sides, side, key).every(neighbour =>
      isQuietNeighbour(sides, key, side, neighbour)
    )
  )

const interchangeableByDefinition = (sides: OrderedSides): string[] => {
  const keys = new Set(SIDE_NAMES.flatMap(side => sides.keys[side]))
  return [...keys]
    .filter(
      key =>
        isRepeatedByDefinition(sides, key) &&
        isCoreByDefinition(sides, key) &&
        isQuietByDefinition(sides, key)
    )
    .sort()
}

const NEIGHBOUR_ROWS: readonly Row[] = [
  ['a neighbour the keeping side drops', 'K K U V', 'K U V', 'K K V', []],
  ['a neighbour the dropping side drops', 'U K K', 'K', 'U K K', []],
  [
    'an insertion on the dropping side beside the copies',
    'K K U',
    'K Z U',
    'K K U',
    [],
  ],
  [
    'an inserted identical pair beside the copies on the dropping side',
    'K K U',
    'K J J U',
    'K K U',
    [],
  ],
  [
    'a replacement inserted on the dropping side',
    'K K K U',
    'J K U J*',
    'U K K K',
    [],
  ],
  [
    'one repeated key after a dropped copy that changes blocks',
    'P K K Q T R R',
    'K T R',
    'P* K K Q* R R T',
    [],
  ],
  [
    'two repeated keys after a dropped copy that changes blocks',
    'P K K Q T R R S S',
    'K T R S',
    'P* K K Q* R R S S T',
    ['S'],
  ],
  [
    'a fixed tied key beside the interchangeable one',
    'K K T T U',
    'K K X T U',
    'K T T U',
    ['K'],
  ],
]

describe('collapsibleKeys', () => {
  describe.each([
    ...ACCEPTED_ROWS,
    ...REFUSED_BY_THE_COPIES_ROWS,
    ...NEIGHBOUR_ROWS,
  ])('given %s', (_name, ancestor, local, other, expected) => {
    describe('when deciding which keys are interchangeable', () => {
      it('then they are the expected keys', () => {
        // Arrange
        const sides = orderedSides(ancestor, local, other)

        const sut = collapsibleKeys

        // Act
        const result = [...sut(sides)].sort()

        // Assert
        expect(result).toStrictEqual(expected)
      })
    })
  })

  describe('given sides whose keys are each held once', () => {
    describe('when deciding the collapsible keys', () => {
      it('then no copy is compared', () => {
        // Arrange
        const sides = orderedSides('A B', 'A B', 'A B')
        vi.mocked(jsonIdentical).mockClear()

        const sut = collapsibleKeys

        // Act
        sut(sides)

        // Assert
        expect(jsonIdentical).not.toHaveBeenCalled()
      })
    })
  })

  describe.each(['nocut-dropone', 'movedcut'] as const)(
    'given the %s layout at r = 2, m = 2',
    layout => {
      describe('when deciding which keys are interchangeable', () => {
        it('then every gadget key is', () => {
          // Arrange
          const sides = layoutSides(layout, 2, 2)

          const sut = collapsibleKeys

          // Act
          const result = [...sut(sides)].sort()

          // Assert
          expect(result).toStrictEqual(['R0', 'R1'])
        })
      })
    }
  )

  describe('given generated sides', () => {
    describe('when deciding which keys are interchangeable', () => {
      it.each(GENERATED_CASES)(
        'then the keys of %s are those the definition finds',
        (_name, cases) => {
          fc.assert(
            fc.property(cases, ([ancestor, local, other]) => {
              // Arrange
              const sides = orderedSides(
                ancestor.join(' '),
                local.join(' '),
                other.join(' ')
              )
              const expected = interchangeableByDefinition(sides)

              const sut = collapsibleKeys

              // Act
              const result = [...sut(sides)].sort()

              // Assert
              expect(result).toStrictEqual(expected)
            })
          )
        }
      )
    })
  })

  describe.each(
    LAYOUT_SHAPES.flatMap(layout =>
      LAYOUT_COPIES.flatMap(copies =>
        LAYOUT_GADGETS.map(gadgets => [layout, copies, gadgets] as const)
      )
    )
  )('given the %s layout at r = %i, m = %i', (layout, copies, gadgets) => {
    describe('when deciding which keys are interchangeable', () => {
      it('then the keys are those the definition finds', () => {
        // Arrange
        const sides = layoutSides(layout, copies, gadgets)
        const expected = interchangeableByDefinition(sides)

        const sut = collapsibleKeys

        // Act
        const result = [...sut(sides)].sort()

        // Assert
        expect(result).toStrictEqual(expected)
      })
    })
  })

  describe.each([
    ['spans of identical copies one side drops', groupCaseArb],
    [
      'repeated keyed and keyless keys',
      caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
    ],
  ])('given generated sides of %s', (_name, cases) => {
    describe('when every key is renamed', () => {
      it('then the interchangeable keys are the same keys renamed', () => {
        fc.assert(
          fc.property(cases, ([ancestor, local, other]) => {
            // Arrange
            const original = orderedSides(
              ancestor.join(' '),
              local.join(' '),
              other.join(' ')
            )
            const renamed = orderedSides(
              ancestor.map(relabelled).join(' '),
              local.map(relabelled).join(' '),
              other.map(relabelled).join(' ')
            )
            const expected = [...collapsibleKeys(original)]
              .map(relabelled)
              .sort()

            const sut = collapsibleKeys

            // Act
            const result = [...sut(renamed)].sort()

            // Assert
            expect(result).toStrictEqual(expected)
          })
        )
      })
    })
  })
})

describe('groupCaseArb', () => {
  describe('given the sampled cases', () => {
    const sampled = fc.sample(groupCaseArb, REACH_RUNS)

    describe('when deciding which keys are interchangeable', () => {
      it('then enough of them hold an interchangeable key', () => {
        // Arrange
        const sut = collapsibleKeys

        // Act
        const result = sampled.filter(
          ([ancestor, local, other]) =>
            sut(
              orderedSides(ancestor.join(' '), local.join(' '), other.join(' '))
            ).size > 0
        )

        // Assert
        expect(result.length).toBeGreaterThanOrEqual(MIN_INTERCHANGEABLE)
      })
    })

    describe('when looking for a copy with its fields reordered', () => {
      it('then enough of them hold one', () => {
        // Arrange
        const holdsReordered = (side: readonly string[]): boolean =>
          side.some(token => token.endsWith(REORDERED_MARK))

        // Act
        const result = sampled.filter(sides => sides.some(holdsReordered))

        // Assert
        expect(result.length).toBeGreaterThanOrEqual(MIN_REORDERED)
      })
    })
  })
})
