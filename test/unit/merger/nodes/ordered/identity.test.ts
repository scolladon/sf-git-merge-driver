import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyedSides } from '../../../../../src/merger/nodes/KeyedArrayIndex.js'
import {
  type Matching,
  matchingsOf,
  surplusMatchings,
} from '../../../../../src/merger/nodes/keyedReadings.js'
import { collapsibleKeys } from '../../../../../src/merger/nodes/ordered/collapsible.js'
import { PairedCopies } from '../../../../../src/merger/nodes/ordered/copyPairings.js'
import {
  type GroupedTies,
  identityTies,
} from '../../../../../src/merger/nodes/ordered/identity.js'
import { isTied } from '../../../../../src/merger/nodes/ordered/identityComponents.js'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import {
  ABSENT_POSITION,
  type OrderedEntry,
  type Reading,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import type {
  JsonArray,
  JsonObject,
} from '../../../../../src/types/jsonTypes.js'
import { signatureOf } from '../../../../../src/utils/jsonSignature.js'
import { identityTies as draftTies } from '../../../../utils/oracles/draftIdentity/identity.js'
import * as reference from '../../../../utils/oracles/enumeratedIdentity.js'
import {
  identify as streamIdentify,
  identityTies as streamTies,
} from '../../../../utils/oracles/representativeMerge/identity.js'
import {
  type Case,
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
  type Limits,
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
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
  readingsOf,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

vi.mock(
  '../../../../../src/merger/nodes/keyedReadings.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/nodes/keyedReadings.js')
      >()
    return {
      ...original,
      matchingsOf: vi.fn(original.matchingsOf),
      surplusMatchings: vi.fn(original.surplusMatchings),
    }
  }
)

function* replayed(matchings: readonly Matching[]): Generator<Matching> {
  yield* matchings
}

// The mock receives the sides' own entries: local's first one tells it apart
const craftSideMatchings = (
  sides: ReturnType<typeof orderedSides>,
  local: readonly Matching[],
  other: readonly Matching[]
): void => {
  vi.mocked(matchingsOf).mockImplementation((_ancestor, side) =>
    replayed(side[0] === sides.local[0] ? local : other)
  )
}

const craftRestMatchings = (rest: readonly Matching[]): void => {
  vi.mocked(surplusMatchings).mockImplementation(() => replayed(rest))
}

// The stream of readings, as the merge walks it
const identify = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
): Iterable<Reading> => identityTies(ancestor, local, other, keys).readings()

const NONE = '-'

const placed = (position: number): string =>
  position < 0 ? NONE : String(position)

// key@ancestor,local,other positions of every entry, in id order
const shapeOf = (reading: Reading): string =>
  reading
    .map(
      e =>
        `${e.key}@${placed(e.ancestorPos)},${placed(e.localPos)},${placed(e.otherPos)}`
    )
    .join(' ')

const referenceReadings = (
  sides: ReturnType<typeof orderedSides>
): readonly Reading[] =>
  reference.identify(sides.ancestor, sides.local, sides.other, sides.keys)

const identifiedFrom = (
  sides: ReturnType<typeof orderedSides>
): readonly Reading[] => [
  ...identify(sides.ancestor, sides.local, sides.other, sides.keys),
]

const ENTRY_SIDES = ['ancestor', 'local', 'other'] as const

const sameValueReferences = (
  actual: readonly Reading[],
  expected: readonly Reading[]
): boolean =>
  actual.every((reading, at) =>
    reading.every((entry, id) =>
      ENTRY_SIDES.every(side => entry[side] === expected[at][id][side])
    )
  )

// toStrictEqual ignores the order of the fields, the hidden class keeps it
const fieldOrderOf = (reading: Reading): readonly string[][] =>
  reading.map(entry => Object.keys(entry))

type GridVariant = 'identical' | 'distinct'

type GridSide = 'ancestor' | 'local' | 'other'

const gridEntry = (key: string, label: string): JsonObject => ({
  fullName: key,
  label,
})

const edited = (entry: JsonObject): JsonObject => ({
  ...entry,
  label: `${entry['label']} edited`,
})

const copiesOf = (variant: GridVariant, key: number, r: number): JsonObject[] =>
  Array.from({ length: r }, (_, copy) =>
    gridEntry(
      `R${key}`,
      variant === 'identical' ? `R${key}` : `R${key} c${copy}`
    )
  )

// identical: local edits copy 0, other deletes copy 1. distinct: local edits
// copies 0 and 1, other moves the last copy first and edits it.
const perturbedCopies = (
  variant: GridVariant,
  copies: readonly JsonObject[],
  side: Exclude<GridSide, 'ancestor'>
): JsonObject[] => {
  if (variant === 'identical') {
    return side === 'local'
      ? [edited(copies[0]), ...copies.slice(1)]
      : copies.filter((_, copy) => copy !== 1)
  }
  return side === 'local'
    ? copies.map((entry, copy) => (copy < 2 ? edited(entry) : entry))
    : [edited(copies[copies.length - 1]), ...copies.slice(0, -1)]
}

const gridSide = (
  variant: GridVariant,
  r: number,
  m: number,
  side: GridSide
): JsonObject[] =>
  Array.from({ length: m }, (_, key) => {
    const copies = copiesOf(variant, key, r)
    const body =
      side === 'ancestor' ? copies : perturbedCopies(variant, copies, side)
    return [gridEntry(`U${key}a`, 'u'), ...body, gridEntry(`U${key}b`, 'u')]
  }).flat()

const gridReadings = (
  variant: GridVariant,
  r: number,
  m: number
): Iterable<Reading> => {
  const [ancestor, local, other] = (
    ['ancestor', 'local', 'other'] as const
  ).map(side => gridSide(variant, r, m, side))
  const keysOf = (side: JsonObject[]): string[] =>
    side.map(entry => entry['fullName'] as string)
  return identify(ancestor, local, other, {
    ancestor: keysOf(ancestor),
    local: keysOf(local),
    other: keysOf(other),
  })
}

const identifyGrid = (
  variant: GridVariant,
  r: number,
  m: number
): readonly Reading[] => [...gridReadings(variant, r, m)]

const COPY_COUNTS = [2, 3, 4, 5]

const EDIT_SUFFIX = /[*+]+$/

type Names = Readonly<Record<string, string>>

const SECOND_KEYS: Names = {
  A: 'C',
  B: 'D',
  X: 'E',
  '~a': '~c',
  '~b': '~d',
}

const RENAMED_KEYS: Names = {
  A: 'Q',
  B: 'R',
  X: 'Y',
  '~a': '~q',
  '~b': '~r',
}

// A token or a key, edit marks kept: 'A*' becomes 'Q*'
const renamed = (names: Names, name: string): string => {
  const stem = name.replace(EDIT_SUFFIX, '')
  return `${names[stem]}${name.slice(stem.length)}`
}

const renamedCase = (names: Names, [ancestor, local, other]: Case): Case => {
  const rename = (token: string): string => renamed(names, token)
  return [ancestor.map(rename), local.map(rename), other.map(rename)]
}

const identifyCase = ([ancestor, local, other]: Case): readonly Reading[] => {
  const sides = orderedSides(
    ancestor.join(' '),
    local.join(' '),
    other.join(' ')
  )
  return [...identify(sides.ancestor, sides.local, sides.other, sides.keys)]
}

type Place = (entry: OrderedEntry) => string

const unchanged: Place = entry =>
  `${entry.ancestorPos},${entry.localPos},${entry.otherPos}`

const signatureOfPlaces = (places: readonly string[]): string =>
  [...places].sort().join(' ')

// The readings as a multiset: ids and order ignored
const placementsOf = (
  found: readonly Reading[],
  place: Place
): readonly string[] =>
  found.map(reading => signatureOfPlaces(reading.map(place))).sort()

const shiftedBy = (shift: number, position: number): number =>
  position === ABSENT_POSITION ? position : position + shift

const shiftedPlace =
  ([ancestor, local, other]: readonly number[]): Place =>
  entry =>
    [
      shiftedBy(ancestor, entry.ancestorPos),
      shiftedBy(local, entry.localPos),
      shiftedBy(other, entry.otherPos),
    ].join(',')

const SEPARATOR_TOKEN = 'Z'

const aroundSeparator = (first: Case, second: Case): Case => [
  [...first[0], SEPARATOR_TOKEN, ...second[0]],
  [...first[1], SEPARATOR_TOKEN, ...second[1]],
  [...first[2], SEPARATOR_TOKEN, ...second[2]],
]

// Each reading of a part followed by each reading of the next, around the
// separator held at the end of the first part's sides.
const placementsAround = (
  first: readonly Reading[],
  second: readonly Reading[],
  firstLengths: readonly number[]
): readonly string[] => {
  const separator = firstLengths.join(',')
  const shift = shiftedPlace(firstLengths.map(length => length + 1))
  return first
    .flatMap(head =>
      second.map(tail =>
        signatureOfPlaces([
          ...head.map(unchanged),
          separator,
          ...tail.map(shift),
        ])
      )
    )
    .sort()
}

const signaturesOn = (side: JsonArray): ReadonlySet<string> =>
  new Set((side as JsonObject[]).map(signatureOf))

// Whether the first reading, the best by stage 1, shares every value both
// live sides hold.
const keepsEveryHeldValue = (tokens: Case): boolean => {
  const sides = orderedSides(
    tokens[0].join(' '),
    tokens[1].join(' '),
    tokens[2].join(' ')
  )
  const onOther = signaturesOn(sides.other)
  const held = [...signaturesOn(sides.local)].filter(s => onOther.has(s))
  const [first] = identifyCase(tokens)
  const shared = new Set(
    first
      .filter(entry => entry.local && entry.other)
      .flatMap(entry => [
        signatureOf(entry.local as JsonObject),
        signatureOf(entry.other as JsonObject),
      ])
  )
  return held.every(signature => shared.has(signature))
}

const WIDE: Limits = {
  length: 10,
  perKey: { A: 4, B: 3, X: 1, '~a': 3, '~a*': 2, '~b': 2 },
}

const MAX_TIED_READINGS = 1024

const identicalCells = (): (readonly [copies: number, keys: number])[] =>
  COPY_COUNTS.flatMap(copies => {
    const cells: (readonly [number, number])[] = []
    for (let keys = 1; copies ** keys <= MAX_TIED_READINGS; keys++) {
      cells.push([copies, keys])
    }
    return cells
  })

const startsWithAncestorLabel = (entry: OrderedEntry): boolean => {
  const label = (entry.ancestor as JsonObject)['label'] as string
  return [entry.local, entry.other].every(value =>
    ((value as JsonObject)['label'] as string).startsWith(label)
  )
}

const LAYOUT_COPIES = [2, 3]
const LAYOUT_GADGETS = [1, 2, 3, 4]

const LAYOUT_CELLS = LAYOUT_SHAPES.flatMap(shape =>
  LAYOUT_COPIES.flatMap(copies =>
    LAYOUT_GADGETS.map(gadgets => [shape, copies, gadgets] as const)
  )
)

const GENERATED_CASES: readonly (readonly [string, fc.Arbitrary<Case>])[] = [
  [
    'repeated keyed and keyless keys',
    caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  ],
  ['few repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
  [
    'repeated keyed and keyless keys joined by unique keys',
    cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  ],
  ['spans of identical copies one side drops', groupCaseArb],
]

const sidesFrom = ([ancestor, local, other]: Case) =>
  orderedSides(ancestor.join(' '), local.join(' '), other.join(' '))

const JOINED_CASES: readonly (readonly [string, fc.Arbitrary<Case>])[] = [
  [
    'repeated keyed and keyless keys',
    cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  ],
  ['few repeated keys', cutCaseArb(SMALL_ANCESTORS, SMALL)],
]

describe('identify', () => {
  describe('given sides whose keys are unique', () => {
    it('then it reads one entry per key at the written positions', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B C', 'B A C', 'A C B')

      // Assert
      expect(result.map(shapeOf)).toEqual(['A@0,1,0 B@1,0,2 C@2,2,1'])
    })
  })

  describe('given a key held at most once on every side', () => {
    it('then no pairing is enumerated', () => {
      // Arrange
      const sut = readingsOf

      // Act
      sut('A B', 'A B', 'A B')

      // Assert
      expect(matchingsOf).not.toHaveBeenCalled()
    })
  })

  describe.each([
    ['one side adds a key', 'A', 'A X', 'A', 'A@0,0,0 X@-,1,-'],
    ['both sides add the same key', '', 'X', 'X', 'X@-,0,0'],
  ])('given %s', (_title, ancestor, local, other, expected) => {
    it('then the added key is one entry', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.map(shapeOf)).toEqual([expected])
    })
  })

  describe('given a key only local adds', () => {
    it('then its entry holds the local value and no other side, fields in reading order', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const [reading] = sut('A', 'A X', 'A')

      // Assert
      const added = reading[1]
      expect(Object.keys(added)).toEqual([
        'id',
        'key',
        'local',
        'ancestorPos',
        'localPos',
        'otherPos',
      ])
      expect('other' in added).toBe(false)
    })
  })

  describe('given a key repeated on the ancestor and edited on one side', () => {
    it('then every pairing of its copies is a reading', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A', 'A*')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        [
          'A@0,0,0 A@2,-,- B@1,-,-',
          'A@0,0,- A@2,-,0 B@1,-,-',
          'A@0,-,0 A@2,0,- B@1,-,-',
          'A@0,-,- A@2,0,0 B@1,-,-',
        ].sort()
      )
    })
  })

  describe('given a value both sides hold that a reading would lose', () => {
    it('then only the readings pairing it on both sides remain', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A B', 'B A')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        ['A@0,0,1 A@2,-,- B@1,1,0', 'A@0,-,- A@2,0,1 B@1,1,0'].sort()
      )
    })
  })

  describe('given readings that differ in the moves they fabricate', () => {
    it('then only the readings with the fewest moves remain', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A B', 'A* B A')

      // Assert
      expect(result.map(shapeOf)).toEqual(['A@0,0,0 A@2,-,2 B@1,1,1'])
    })
  })

  describe.each([
    [
      'a side adds a new key next to a repeated one',
      'A B A',
      'A',
      'A X',
      ['A@0,0,0 A@2,-,- B@1,-,- X@-,-,1', 'A@0,-,- A@2,0,0 B@1,-,- X@-,-,1'],
    ],
    [
      'a rotation of distinct keys around a repeated one',
      'A B C A',
      'A B C',
      'C A B',
      ['A@0,0,1 A@3,-,- B@1,1,2 C@2,2,0'],
    ],
    [
      'keyless entries',
      '~a ~a ~b',
      '~a ~b',
      '~a ~a ~b*',
      [
        '~a@0,0,0 ~a@1,-,1 ~b@2,1,- ~b*@-,-,2',
        '~a@0,-,0 ~a@1,0,1 ~b@2,1,- ~b*@-,-,2',
      ],
    ],
  ])('given %s', (_title, ancestor, local, other, expected) => {
    it('then it reads the expected pairings', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.map(shapeOf).sort()).toEqual([...expected].sort())
    })
  })

  describe.each([
    ['the ancestor', 'A A', 'A', 'A'],
    ['the local side', 'A', 'A A', 'A'],
    ['the other side', 'A', 'A', 'A A'],
  ])('given a key repeated on only %s', (_title, ancestor, local, other) => {
    it('then every copy is an entry', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.every(reading => reading.length === 2)).toBe(true)
    })
  })

  describe('given no ancestor and readings tied on moves', () => {
    it('then every tied reading remains', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('', 'A C C', 'C')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        ['A@-,0,- C@-,1,0 C@-,2,-', 'A@-,0,- C@-,2,0 C@-,1,-'].sort()
      )
    })
  })
  describe('given thousands of unique keys', () => {
    // Linear code takes ~100 ms at SIZE under coverage; the per-pair version
    // took ~17 s plain. The budget sits between the two so that CPU load and
    // coverage instrumentation cannot push the linear code over it.
    const SIZE = 16_000
    const BUDGET_MS = 1400
    const QUADRATIC_GUARD_TIMEOUT_MS = 120_000
    const tokens = Array.from({ length: SIZE }, (_, i) => `V${i}`)
    const timed = (ancestor: string, local: string, other: string): number => {
      const start = performance.now()
      readingsOf(ancestor, local, other)
      return performance.now() - start
    }

    it(
      'then identical sides are identified within the budget',
      () => {
        // Arrange
        const text = tokens.join(' ')

        // Act
        const elapsed = timed(text, text, text)

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )

    it(
      'then one-sided edits are identified within the budget',
      () => {
        // Arrange
        const text = tokens.join(' ')
        const edited = tokens.map((t, i) => (i % 2 ? t : `${t}x`)).join(' ')

        // Act
        const elapsed = timed(text, edited, text)

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )
  })

  describe('given the identical grid at r = 2, m = 9', () => {
    // 4^9 pairings enumerate in seconds; the 2^9 tied readings come back in
    // milliseconds. The budget sits between the two so that CPU load and
    // coverage instrumentation cannot push the selection over it.
    const COPIES = 2
    const KEYS = 9
    const TIED_READINGS = 512
    const BUDGET_MS = 400
    const GRID_TIMEOUT_MS = 120_000

    describe('when identifying', () => {
      it(
        'then its tied readings come back within the budget',
        () => {
          // Arrange
          const start = performance.now()

          // Act
          const sut = identifyGrid('identical', COPIES, KEYS)
          const elapsed = performance.now() - start

          // Assert
          expect(sut).toHaveLength(TIED_READINGS)
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe.each([
    ['key order', { a: '1', b: '2' }, { b: '2', a: '1' }, 1],
    [
      'nested key order',
      { a: { x: '1', y: '2' } },
      { a: { y: '2', x: '1' } },
      1,
    ],
    ['array elements', { a: ['1', '2'] }, { a: ['1', '2'] }, 1],
    ['null members', { a: null }, { a: null }, 1],
    ['array order', { a: ['1', '2'] }, { a: ['2', '1'] }, 2],
    ['array against object', { a: ['1'] }, { a: { 0: '1' } }, 2],
    ['string against object', { a: 'ab' }, { a: { 0: 'a', 1: 'b' } }, 2],
    ['null against object', { a: null }, { a: {} }, 2],
  ])(
    'given a value held by both sides differing by %s',
    (_title, held, twin, count) => {
      it('then the value counts as held only when the sides carry equal ones', () => {
        // Arrange
        const keys = { ancestor: [], local: ['K', 'K'], other: ['K'] }

        // Act
        const result = [...identify([], [{ a: 'x' }, held], [twin], keys)]

        // Assert
        expect(result).toHaveLength(count)
      })
    }
  )

  describe('given a value that only the other side of a shared entry carries', () => {
    it('then that entry keeps the value held', () => {
      // Arrange
      const v = (a: string) => ({ a })
      const keys = {
        ancestor: ['M', 'K'],
        local: ['L', 'L', 'K'],
        other: ['L', 'K'],
      }

      // Act
      const result = [
        ...identify(
          [v('2'), v('2')],
          [v('1'), v('2'), v('1')],
          [v('3'), v('2')],
          keys
        ),
      ]

      // Assert
      expect(result.map(shapeOf)).toEqual([
        'M@0,-,- K@1,2,1 L@-,0,0 L@-,1,-',
        'M@0,-,- K@1,2,1 L@-,1,0 L@-,0,-',
      ])
    })
  })

  describe('given a held value spelled with another key order on one side', () => {
    it('then only the readings keeping it remain', () => {
      // Arrange
      const local = (a: string) => ({ a, b: 'z' })
      const other = (a: string) => ({ b: 'z', a })
      const keys = {
        ancestor: ['L', 'M', 'M'],
        local: ['K', 'K', 'M'],
        other: ['M'],
      }

      // Act
      const result = [
        ...identify(
          [local('3'), local('1'), local('1')],
          [local('2'), local('1'), local('1')],
          [other('1')],
          keys
        ),
      ]

      // Assert
      expect(result.map(shapeOf)).toEqual([
        'L@0,-,- M@1,2,0 M@2,-,- K@-,0,- K@-,1,-',
        'L@0,-,- M@1,-,- M@2,2,0 K@-,0,- K@-,1,-',
      ])
    })
  })

  describe('given keyed and keyless repeated keys', () => {
    describe('when identified', () => {
      it('then the readings equal the enumerating reference, in order, values by reference', () => {
        fc.assert(
          fc.property(
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            ([ancestor, local, other]) => {
              // Arrange
              const sides = orderedSides(
                ancestor.join(' '),
                local.join(' '),
                other.join(' ')
              )
              const expected = referenceReadings(sides)

              // Act
              const sut = [
                ...identify(
                  sides.ancestor,
                  sides.local,
                  sides.other,
                  sides.keys
                ),
              ]

              // Assert
              expect(sut).toStrictEqual(expected)
              expect(sameValueReferences(sut, expected)).toBe(true)
              expect(sut.map(fieldOrderOf)).toEqual(expected.map(fieldOrderOf))
            }
          )
        )
      })
    })
  })

  describe.each(LAYOUT_CELLS)(
    'given the %s layout at r = %i, m = %i',
    (shape, copies, gadgets) => {
      describe('when identified', () => {
        it('then the readings equal the enumerating reference, in order', () => {
          // Arrange
          const sides = layoutSides(shape, copies, gadgets)
          const expected = referenceReadings(sides)

          // Act
          const sut = identifiedFrom(sides)

          // Assert
          expect(sut).toStrictEqual(expected)
          expect(sameValueReferences(sut, expected)).toBe(true)
        })
      })
    }
  )

  describe('given generated sides', () => {
    describe('when identified', () => {
      it.each(GENERATED_CASES)(
        'then the readings of %s are those of the tie set before grouping',
        (_name, cases) => {
          fc.assert(
            fc.property(cases, tokens => {
              // Arrange
              const sides = sidesFrom(tokens)
              const expected = [
                ...streamIdentify(
                  sides.ancestor,
                  sides.local,
                  sides.other,
                  sides.keys
                ),
              ]

              // Act
              const sut = identifiedFrom(sides)

              // Assert
              expect(sut).toStrictEqual(expected)
            })
          )
        }
      )
    })
  })

  describe.each(LAYOUT_CELLS)(
    'given the %s layout at r = %i, m = %i',
    (shape, copies, gadgets) => {
      describe('when identified', () => {
        it('then the readings are those of the tie set before grouping', () => {
          // Arrange
          const sides = layoutSides(shape, copies, gadgets)
          const expected = [
            ...streamIdentify(
              sides.ancestor,
              sides.local,
              sides.other,
              sides.keys
            ),
          ]

          // Act
          const sut = identifiedFrom(sides)

          // Assert
          expect(sut).toStrictEqual(expected)
        })
      })
    }
  )

  describe('given parts joined by unique keys', () => {
    describe('when identified', () => {
      it.each(JOINED_CASES)(
        'then the readings of %s equal the enumerating reference, in order',
        (_name, joinedCase) => {
          fc.assert(
            fc.property(joinedCase, ([ancestor, local, other]) => {
              // Arrange
              const sides = orderedSides(
                ancestor.join(' '),
                local.join(' '),
                other.join(' ')
              )
              const expected = referenceReadings(sides)

              // Act
              const sut = identifiedFrom(sides)

              // Assert
              expect(sut).toStrictEqual(expected)
              expect(sameValueReferences(sut, expected)).toBe(true)
            })
          )
        }
      )
    })
  })

  describe('given an edited keyless copy beside its unedited twins', () => {
    describe('when identified', () => {
      it('then the readings equal the enumerating reference', () => {
        // Arrange
        const sides = orderedSides('~a ~a B', '~a* ~a B', '~a ~a B')
        const expected = referenceReadings(sides)

        // Act
        const sut = [
          ...identify(sides.ancestor, sides.local, sides.other, sides.keys),
        ]

        // Assert
        expect(sut).toStrictEqual(expected)
      })
    })
  })

  describe('given a key repeated on the ancestor and edited apart on both sides', () => {
    describe('when identified', () => {
      it("then each side's copies are matched once", () => {
        // Arrange
        const sides = orderedSides('A A', 'A* A+', 'A* A+')

        // Act
        identifiedFrom(sides)

        // Assert
        expect(matchingsOf).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('given crafted matchings for a key', () => {
    afterEach(() => {
      vi.mocked(matchingsOf).mockReset()
      vi.mocked(surplusMatchings).mockReset()
    })

    describe('when every alternative loses a value both sides hold', () => {
      it('then every alternative stays', () => {
        // Arrange
        const sides = orderedSides('A A', 'A*', 'A*')
        craftSideMatchings(sides, [[[0, 0]], []], [[], [[1, 0]]])
        craftRestMatchings([[]])

        // Act
        const sut = identifiedFrom(sides)

        // Assert
        expect(sut.map(shapeOf)).toEqual([
          'A@0,0,- A@1,-,- A@-,-,0',
          'A@0,0,- A@1,-,0',
          'A@0,-,- A@1,-,- A@-,0,- A@-,-,0',
          'A@0,-,- A@1,-,0 A@-,0,-',
        ])
      })
    })

    describe('when one alternative alone keeps every value', () => {
      it('then it is the one reading', () => {
        // Arrange
        const sides = orderedSides('A A', 'A*', 'A*')
        craftSideMatchings(sides, [[[0, 0]]], [[[1, 0]], [[0, 0]]])

        // Act
        const sut = identifiedFrom(sides)

        // Assert
        expect(sut.map(shapeOf)).toEqual(['A@0,0,0 A@1,-,-'])
      })
    })
  })

  describe('given the distinct grid', () => {
    describe.each(COPY_COUNTS)('at r = %i', copies => {
      describe.each([1, 12, 40])('and m = %i', keys => {
        it('then one reading pairs every copy with its own', () => {
          // Arrange
          const sut = identifyGrid

          // Act
          const result = sut('distinct', copies, keys)

          // Assert
          expect(result).toHaveLength(1)
          expect(
            result[0]
              .filter(entry => entry.ancestor)
              .every(startsWithAncestorLabel)
          ).toBe(true)
        })
      })
    })
  })

  describe('given the distinct grid at thousands of keys', () => {
    // Each key has one fewest-move choice: no walk may nest per key.
    const COPIES = 2
    const KEYS = 5000

    describe('when identifying', () => {
      it('then its one reading comes back', () => {
        // Arrange
        const sut = identifyGrid

        // Act
        const result = sut('distinct', COPIES, KEYS)

        // Assert
        expect(result).toHaveLength(1)
      })
    })
  })

  describe('given the identical grid at r = 2 and thousands of keys', () => {
    // Every key leaves two tied choices: the first reading must come without
    // nesting a frame per key and without building the 2^4000 others.
    const COPIES = 2
    const KEYS = 4000
    // U{k}a, the two copies, U{k}b
    const ENTRIES_PER_KEY = 4
    const GRID_TIMEOUT_MS = 120_000

    describe('when taking the first reading', () => {
      it(
        'then it arrives with every entry',
        () => {
          // Arrange
          const sut = gridReadings('identical', COPIES, KEYS)

          // Act
          const [first] = sut

          // Assert
          expect(first).toHaveLength(ENTRIES_PER_KEY * KEYS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe('given the identical grid', () => {
    describe.each(identicalCells())('at r = %i and m = %i', (copies, keys) => {
      it('then every choice of the edited and deleted copy is a reading', () => {
        // Arrange
        const sut = identifyGrid

        // Act
        const result = sut('identical', copies, keys)

        // Assert
        expect(result).toHaveLength(copies ** keys)
      })
    })
  })

  describe('given sides whose keys are renamed one for one', () => {
    describe('when identified', () => {
      it('then the readings keep their places and carry the renamed keys', () => {
        fc.assert(
          fc.property(
            caseArb(IDENTITY_ANCESTORS, WIDE, IDENTITY_TOKENS),
            tokens => {
              // Arrange
              const expected = identifyCase(tokens)

              // Act
              const sut = identifyCase(renamedCase(RENAMED_KEYS, tokens))

              // Assert
              expect(sut.map(reading => reading.map(unchanged))).toEqual(
                expected.map(reading => reading.map(unchanged))
              )
              expect(sut.map(reading => reading.map(e => e.key))).toEqual(
                expected.map(reading =>
                  reading.map(e => renamed(RENAMED_KEYS, e.key))
                )
              )
            }
          )
        )
      })
    })
  })

  describe('given two parts around an entry unmoved on every side', () => {
    describe('when identified', () => {
      it('then the readings are the product of the parts readings', () => {
        fc.assert(
          fc.property(
            fc.tuple(
              caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
              caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS)
            ),
            ([first, unrenamed]) => {
              // Arrange
              const second = renamedCase(SECOND_KEYS, unrenamed)
              fc.pre(keepsEveryHeldValue(first) === keepsEveryHeldValue(second))
              const expected = placementsAround(
                identifyCase(first),
                identifyCase(second),
                first.map(side => side.length)
              )

              // Act
              const sut = identifyCase(aroundSeparator(first, second))

              // Assert
              expect(placementsOf(sut, unchanged)).toEqual(expected)
            }
          )
        )
      })
    })
  })
})

const tiesOver = (sides: ReturnType<typeof orderedSides>): GroupedTies =>
  identityTies(sides.ancestor, sides.local, sides.other, sides.keys)

const tiesOf = (ancestor: string, local: string, other: string): GroupedTies =>
  tiesOver(orderedSides(ancestor, local, other))

const streamReadings = (
  sides: ReturnType<typeof orderedSides>
): readonly Reading[] => [
  ...streamTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  ).readings(),
]

// The readings choosing alike on every entry whose key is not in the set
const groupOf = (reading: Reading, keys: ReadonlySet<string>): string =>
  JSON.stringify(
    reading
      .filter(entry => !keys.has(entry.key))
      .map(entry => [
        entry.key,
        entry.ancestorPos,
        entry.localPos,
        entry.otherPos,
      ])
  )

const firstOfEachGroup = (
  stream: readonly Reading[],
  keys: ReadonlySet<string>
): readonly Reading[] => {
  const firsts = new Map<string, Reading>()
  for (const reading of stream) {
    const group = groupOf(reading, keys)
    if (!firsts.has(group)) firsts.set(group, reading)
  }
  return [...firsts.values()]
}

const keysOfSides = (
  sides: ReturnType<typeof orderedSides>
): readonly string[] => [
  ...new Set([
    ...sides.keys.ancestor,
    ...sides.keys.local,
    ...sides.keys.other,
  ]),
]

const draftTiesOver = (sides: ReturnType<typeof orderedSides>): GroupedTies =>
  draftTies(sides.ancestor, sides.local, sides.other, sides.keys)

// The draft-built tie set walks every reading of every generated case twice
const DRAFT_ORACLE_TIMEOUT_MS = 60_000

const expectSameTies = (
  actual: GroupedTies,
  expected: GroupedTies,
  keys: ReadonlySet<string>
): void => {
  const readings = [...actual.readings()]
  expect(actual.first).toStrictEqual(expected.first)
  expect(actual.components).toStrictEqual(expected.components)
  expect(readings).toStrictEqual([...expected.readings()])
  expect(readings.map(fieldOrderOf)).toEqual(
    [...expected.readings()].map(fieldOrderOf)
  )
  expect([...actual.representatives(keys)]).toStrictEqual([
    ...expected.representatives(keys),
  ])
}

const withAnyKeys = (cases: fc.Arbitrary<Case>) =>
  cases.chain(tokens => {
    const sides = sidesFrom(tokens)
    return fc
      .subarray([...keysOfSides(sides)])
      .map(keys => ({ sides, keys: new Set(keys) }))
  })

type GroupRow = readonly [
  name: string,
  sides: ReturnType<typeof orderedSides>,
  positions: readonly number[],
]

const GROUP_ROWS: readonly GroupRow[] = [
  [
    'two repeated keys after a dropped copy, one interchangeable, sharing a component with the other',
    orderedSides('P K K Q T R R S S', 'K T R S', 'P* K K Q* R R S S T'),
    [0, 2, 4, 6],
  ],
  [
    'a fixed tied key after the interchangeable one',
    orderedSides('K K T T U', 'K K X T U', 'K T T U'),
    [0, 1],
  ],
  [
    'an interchangeable key between two fixed ones',
    orderedSides('P b b Q K K V', 'a P a b Q K V', 'P b b Q a K K V'),
    [0, 1, 4, 5],
  ],
  [
    'a dropped copy whose twin lists its fields in another order',
    orderedSides('K K U', 'K U', 'K^ K U'),
    [0, 1],
  ],
  [
    'the nocut-dropinsert layout at r = 2, m = 2',
    layoutSides('nocut-dropinsert', 2, 2),
    [0, 1, 2, 3],
  ],
]

describe('identityTies', () => {
  describe('given two repeated keys apart around a unique key', () => {
    const ancestor = 'A A C B B'
    const local = 'A C B'
    const other = 'A A C B B Z'

    describe('when exposing the tie set', () => {
      it('then it holds one component per key, each keyed by its stretch, from the first choice', () => {
        // Arrange
        const sut = tiesOf(ancestor, local, other)

        // Act
        const result = sut.components.map(({ members }) =>
          members.map(sut.keyOf)
        )

        // Assert
        expect(sut.first).toEqual([0, 0, 0, 0])
        expect(result).toEqual([['A'], ['B']])
      })
    })

    describe('when asking the key of a stretch of unique keys', () => {
      it('then it is the first key of the stretch', () => {
        // Arrange
        const sut = tiesOf(ancestor, local, other)
        const fusedStretches = [1, 3]

        // Act
        const result = fusedStretches.map(sut.keyOf)

        // Assert
        expect(result).toEqual(['C', 'Z'])
      })
    })

    describe('when walking one component around a base choosing the second tuple of the other', () => {
      it('then the choice of the base stays', () => {
        // Arrange
        const sut = tiesOf(ancestor, local, other)
        const [, base] = sut.around([1], sut.first)

        // Act
        const result = [...sut.around([0], base)]

        // Assert
        expect(result).toEqual([
          [0, 0, 1, 0],
          [1, 0, 1, 0],
        ])
        expect([...sut.around([0], sut.first)][0]).toEqual(sut.first)
      })
    })

    describe('when reading every choice of both components from the first', () => {
      it('then the readings are the stream readings, in order', () => {
        // Arrange
        const sut = tiesOf(ancestor, local, other)
        const expected = readingsOf(ancestor, local, other)

        // Act
        const result = [...sut.around([0, 1], sut.first)].map(sut.readingOf)

        // Assert
        expect(result).toEqual(expected)
        expect([...sut.readings()]).toEqual(expected)
      })
    })
  })

  describe('given the nocut-identical layout at r = 3, m = 3', () => {
    describe('when exposing the tie set', () => {
      it('then each repeated key is a component with three least tuples', () => {
        // Arrange
        const sides = layoutSides('nocut-identical', 3, 3)

        // Act
        const sut = tiesOver(sides)

        // Assert
        expect(sut.components.map(({ members }) => members)).toEqual([
          [0],
          [1],
          [2],
        ])
        expect(sut.components.map(({ minimal }) => minimal.length)).toEqual([
          3, 3, 3,
        ])
      })
    })
  })

  describe('given the nocut-identical layout at r = 2, m = 2, keys with no entry between them', () => {
    describe('when exposing the tie set', () => {
      it('then the keys are two components', () => {
        // Arrange
        const sides = layoutSides('nocut-identical', 2, 2)

        // Act
        const sut = tiesOver(sides)

        // Assert
        expect(sut.components.map(({ members }) => members)).toEqual([[0], [1]])
      })

      it('then the readings equal the enumerating reference', () => {
        // Arrange
        const sides = layoutSides('nocut-identical', 2, 2)
        const sut = tiesOver(sides)

        // Act
        const result = [...sut.readings()]

        // Assert
        expect(result).toStrictEqual(referenceReadings(sides))
      })
    })
  })

  describe('given the nocut-identical layout at r = 3, m = 7', () => {
    // Every pairing of the one fused component took seconds; split where no
    // point lies between the keys, each key is decided alone. The budget sits
    // between the two so that CPU load and coverage instrumentation cannot
    // push it over.
    const COPIES = 3
    const GADGETS = 7
    const BUDGET_MS = 400
    const GRID_TIMEOUT_MS = 120_000

    describe('when exposing the tie set', () => {
      it(
        'then one component per key comes back within the budget',
        () => {
          // Arrange
          const sides = layoutSides('nocut-identical', COPIES, GADGETS)
          const start = performance.now()

          // Act
          const sut = tiesOver(sides)
          const elapsed = performance.now() - start

          // Assert
          expect(sut.components).toHaveLength(GADGETS)
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe('given the nocut-dropone layout at r = 3, m = 4', () => {
    describe('when grouping by its interchangeable keys', () => {
      it('then one reading stands for all, the first', () => {
        // Arrange
        const sides = layoutSides('nocut-dropone', 3, 4)
        const sut = tiesOver(sides)

        // Act
        const result = [...sut.representatives(collapsibleKeys(sides))]

        // Assert
        expect(result).toStrictEqual([sut.readingOf(sut.first)])
        expect([...sut.readings()]).toHaveLength(81)
      })
    })
  })

  describe.each(GROUP_ROWS)('given %s', (_name, sides, positions) => {
    describe('when grouping by its interchangeable keys', () => {
      it('then the representatives stand at their stream positions', () => {
        // Arrange
        const sut = tiesOver(sides)
        const stream = [...sut.readings()]
        const expected = positions.map(at => stream[at])

        // Act
        const result = [...sut.representatives(collapsibleKeys(sides))]

        // Assert
        expect(result).toStrictEqual(expected)
      })
    })
  })

  describe('given generated sides and any set of their keys', () => {
    describe('when grouping by that set', () => {
      it.each(GENERATED_CASES)(
        'then the representatives of %s are the first reading of each group of the stream before grouping, in stream order',
        (_name, cases) => {
          fc.assert(
            fc.property(withAnyKeys(cases), ({ sides, keys }) => {
              // Arrange
              const sut = tiesOver(sides)
              const expected = firstOfEachGroup(streamReadings(sides), keys)

              // Act
              const result = [...sut.representatives(keys)]

              // Assert
              expect(result).toStrictEqual(expected)
            })
          )
        }
      )
    })
  })

  describe('given generated sides of spans of identical copies one side drops', () => {
    describe('when grouping by their interchangeable keys', () => {
      it('then the representatives are the first reading of each group of the stream before grouping, in stream order', () => {
        fc.assert(
          fc.property(groupCaseArb, tokens => {
            // Arrange
            const sides = sidesFrom(tokens)
            const keys = collapsibleKeys(sides)
            const sut = tiesOver(sides)
            const expected = firstOfEachGroup(streamReadings(sides), keys)

            // Act
            const result = [...sut.representatives(keys)]

            // Assert
            expect(result).toStrictEqual(expected)
          })
        )
      })
    })
  })

  describe.each(LAYOUT_CELLS)(
    'given the %s layout at r = %i, m = %i',
    (shape, copies, gadgets) => {
      describe('when grouping by its interchangeable keys', () => {
        it('then the representatives are the first reading of each group of the stream before grouping', () => {
          // Arrange
          const sides = layoutSides(shape, copies, gadgets)
          const keys = collapsibleKeys(sides)
          const sut = tiesOver(sides)
          const expected = firstOfEachGroup(streamReadings(sides), keys)

          // Act
          const result = [...sut.representatives(keys)]

          // Assert
          expect(result).toStrictEqual(expected)
        })
      })
    }
  )

  describe('given generated sides', () => {
    describe('when building the tie set', () => {
      it.each(GENERATED_CASES)(
        'then the tie set of %s equals the draft-built tie set',
        (_name, cases) => {
          fc.assert(
            fc.property(withAnyKeys(cases), ({ sides, keys }) => {
              // Arrange
              const expected = draftTiesOver(sides)

              // Act
              const sut = tiesOver(sides)

              // Assert
              expectSameTies(sut, expected, keys)
            })
          )
        },
        DRAFT_ORACLE_TIMEOUT_MS
      )
    })
  })

  describe.each(LAYOUT_CELLS)(
    'given the %s layout at r = %i, m = %i',
    (shape, copies, gadgets) => {
      describe('when building the tie set', () => {
        it('then it equals the draft-built tie set: one tied component per gadget, r to the power m readings', () => {
          // Arrange
          const sides = layoutSides(shape, copies, gadgets)
          const expected = draftTiesOver(sides)

          // Act
          const sut = tiesOver(sides)

          // Assert
          expectSameTies(sut, expected, collapsibleKeys(sides))
          expect(sut.components.filter(isTied)).toHaveLength(gadgets)
          expect([...sut.readings()]).toHaveLength(copies ** gadgets)
        })
      })
    }
  )

  describe('given a key repeated four times that one side edits and the other drops', () => {
    const sides = orderedSides('Ua A A A A Ub', 'Ua A* A A Ub', 'Ua A A A Ub')

    describe('when building the tie set', () => {
      it('then it holds the sixteen readings of the draft-built tie set', () => {
        // Arrange
        const expected = draftTiesOver(sides)

        // Act
        const sut = tiesOver(sides)

        // Assert
        const shapes = [...sut.readings()].map(shapeOf)
        expectSameTies(sut, expected, collapsibleKeys(sides))
        expect(shapes).toHaveLength(16)
        expect(shapes[0]).toBe(
          'Ua@0,0,0 A@1,1,1 A@2,2,2 A@3,3,3 A@4,-,- Ub@5,4,4'
        )
        expect(shapes[15]).toBe(
          'Ua@0,0,0 A@1,-,- A@2,1,1 A@3,2,2 A@4,3,3 Ub@5,4,4'
        )
      })
    })

    describe('when the tie set is built', () => {
      afterEach(() => {
        vi.restoreAllMocks()
      })

      it('then no alternative builds its drafts until a reading takes it', () => {
        // Arrange
        const drafts = vi.spyOn(PairedCopies.prototype, 'drafts')
        const sut = tiesOver(sides)
        const builtBeforeReading = drafts.mock.calls.length

        // Act
        const readings = [...sut.readings()]

        // Assert
        expect(builtBeforeReading).toBe(0)
        expect(readings).toHaveLength(16)
        expect(drafts).toHaveBeenCalledTimes(16)
      })
    })

    describe('when merging', () => {
      it('then the whole array conflicts', () => {
        // Arrange
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(formatResult(result)).toBe(
          '<Ua,A*,A,A,Ub|Ua,A,A,A,A,Ub|Ua,A,A,A,Ub>'
        )
      })
    })
  })

  describe('given unique keys only', () => {
    describe('when grouping by one of them', () => {
      it('then the one reading stands for its group', () => {
        // Arrange
        const sut = tiesOf('A B', 'A B C', 'A B')

        // Act
        const result = [...sut.representatives(new Set(['A']))]

        // Assert
        expect(result).toStrictEqual([...sut.readings()])
        expect(result).toHaveLength(1)
      })
    })

    describe('when exposing the tie set', () => {
      it('then it has no component and one reading', () => {
        // Arrange
        const sut = tiesOf('A B', 'A B C', 'A B')

        // Act
        const result = [...sut.readings()]

        // Assert
        expect(sut.components).toEqual([])
        expect(sut.first).toEqual([0])
        expect(result).toEqual(readingsOf('A B', 'A B C', 'A B'))
        expect(result).toHaveLength(1)
      })
    })
  })
})
