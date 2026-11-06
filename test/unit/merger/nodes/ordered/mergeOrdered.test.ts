import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildConflictMarkers } from '../../../../../src/merger/ConflictMarkerBuilder.js'
import { identityTies } from '../../../../../src/merger/nodes/ordered/identity.js'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { mergeReading } from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '../../../../../src/types/jsonTypes.js'
import {
  noConflict,
  withConflict,
} from '../../../../../src/types/mergeResult.js'
import { jsonIdentical } from '../../../../../src/utils/jsonEqual.js'
import { mergeOrderedArrays as referenceMerge } from '../../../../utils/oracles/perReadingMerge.js'
import { mergeOrderedArrays as streamMerge } from '../../../../utils/oracles/representativeMerge/mergeOrdered.js'
import { mergeOrderedArrays as tieScanMerge } from '../../../../utils/oracles/tieScanMerge.js'
import {
  type Case,
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
} from '../../../../utils/orderedCases.js'
import {
  cutCaseArb,
  layoutSides,
  shapeSides,
} from '../../../../utils/orderedCuts.js'
import {
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
  toEntry,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

type GridVariant = 'identical' | 'distinct' | 'dropone'

type GridSide = 'ancestor' | 'local' | 'other'

const gridEntry = (key: string, label: string): JsonObject => ({
  fullName: key,
  label,
})

const edited = (entry: JsonObject): JsonObject => ({
  ...entry,
  label: `${entry['label']} edited`,
})

const ADDED_AT_END = gridEntry('Z', 'added')

const copiesOf = (variant: GridVariant, key: number, r: number): JsonObject[] =>
  Array.from({ length: r }, (_, copy) =>
    gridEntry(
      `R${key}`,
      variant === 'distinct' ? `R${key} c${copy}` : `R${key}`
    )
  )

type Perturbation = (
  copies: readonly JsonObject[],
  side: Exclude<GridSide, 'ancestor'>
) => JsonObject[]

// identical: local edits copy 0, other deletes copy 1. distinct: local edits
// copies 0 and 1, other moves the last copy first and edits it. dropone: local
// deletes copy 0, other keeps every copy and appends an entry at the very end
// of its side.
const PERTURBATIONS: Record<GridVariant, Perturbation> = {
  identical: (copies, side) =>
    side === 'local'
      ? [edited(copies[0]), ...copies.slice(1)]
      : copies.filter((_, copy) => copy !== 1),
  distinct: (copies, side) =>
    side === 'local'
      ? copies.map((entry, copy) => (copy < 2 ? edited(entry) : entry))
      : [edited(copies[copies.length - 1]), ...copies.slice(0, -1)],
  dropone: (copies, side) => (side === 'local' ? copies.slice(1) : [...copies]),
}

const gridSide = (
  variant: GridVariant,
  r: number,
  m: number,
  side: GridSide
): JsonObject[] => {
  const body = Array.from({ length: m }, (_, key) => {
    const copies = copiesOf(variant, key, r)
    return [
      gridEntry(`U${key}a`, 'u'),
      ...(side === 'ancestor' ? copies : PERTURBATIONS[variant](copies, side)),
      gridEntry(`U${key}b`, 'u'),
    ]
  }).flat()
  const appended = variant === 'dropone' && side === 'other'
  return appended ? [...body, ADDED_AT_END] : body
}

const keysOf = (side: JsonArray): string[] =>
  side.map(entry => (entry as JsonObject)['fullName'] as string)

const gridSides = (
  variant: GridVariant,
  r: number,
  m: number
): OrderedSides => {
  const [ancestor, local, other] = (
    ['ancestor', 'local', 'other'] as const
  ).map(side => gridSide(variant, r, m, side))
  return {
    ancestor,
    local,
    other,
    keys: {
      ancestor: keysOf(ancestor),
      local: keysOf(local),
      other: keysOf(other),
    },
  }
}

const wrap = (side: JsonArray): JsonArray =>
  side.map(entry => ({ [ORDERED_ATTRIBUTE]: entry }))

const wholeArrayConflict = (sides: OrderedSides) =>
  withConflict([
    buildConflictMarkers(
      wrap(sides.local),
      wrap(sides.ancestor),
      wrap(sides.other)
    ),
  ])

const GRID_VARIANTS: readonly GridVariant[] = [
  'identical',
  'distinct',
  'dropone',
]
const COPY_COUNTS = [2, 3]
const KEY_COUNTS = [1, 2, 3, 4]

const gridCells = (): [GridVariant, number, number][] =>
  GRID_VARIANTS.flatMap(variant =>
    COPY_COUNTS.flatMap(copies =>
      KEY_COUNTS.map((keys): [GridVariant, number, number] => [
        variant,
        copies,
        keys,
      ])
    )
  )

const sidesOfCase = ([ancestor, local, other]: Case): OrderedSides =>
  orderedSides(ancestor.join(' '), local.join(' '), other.join(' '))

describe('mergeOrderedArrays', () => {
  describe.each(gridCells())(
    'given the %s grid at r = %i and m = %i',
    (variant, copies, keys) => {
      describe('when merging', () => {
        it('then the result equals the per-reading merge', () => {
          // Arrange
          const sides = gridSides(variant, copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(
            referenceMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
          )
        })
      })
    }
  )

  describe('given the identical grid at r = 4, m = 7', () => {
    // 4^7 tied readings merge in seconds, the decision needs the first four.
    // The budget sits between the two so that CPU load and coverage
    // instrumentation cannot push the merge over it.
    const COPIES = 4
    const KEYS = 7
    const BUDGET_MS = 400
    const GRID_TIMEOUT_MS = 120_000

    describe('when merging', () => {
      it(
        'then the whole-array conflict comes back within the budget',
        () => {
          // Arrange
          const sides = gridSides('identical', COPIES, KEYS)
          const sut = mergeOrderedArrays
          const start = performance.now()

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)
          const elapsed = performance.now() - start

          // Assert
          expect(result.hasConflict).toBe(true)
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe('given the nocut-dropone layout at r = 3, m = 9', () => {
    // 3^9 tied readings merge in seconds; their copies are interchangeable, so
    // one merge decides. The budget sits between the two so that CPU load and
    // coverage instrumentation cannot push it over.
    const COPIES = 3
    const GADGETS = 9
    const BUDGET_MS = 400
    const GRID_TIMEOUT_MS = 120_000

    describe('when merging', () => {
      it(
        'then the merged layout comes back within the budget',
        () => {
          // Arrange
          const sides = layoutSides('nocut-dropone', COPIES, GADGETS)
          const sut = mergeOrderedArrays
          const start = performance.now()

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)
          const elapsed = performance.now() - start

          // Assert
          expect(result).toStrictEqual(
            noConflict(
              wrap([...sides.local, sides.other[sides.other.length - 1]])
            )
          )
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe('given the movedcut layout at r = 3, m = 9', () => {
    // 3^9 tied readings merge in seconds; their copies are interchangeable, so
    // one merge decides. The budget sits between the two so that CPU load and
    // coverage instrumentation cannot push it over.
    const COPIES = 3
    const GADGETS = 9
    const BUDGET_MS = 400
    const GRID_TIMEOUT_MS = 120_000

    describe('when merging', () => {
      it(
        'then the merged layout comes back within the budget',
        () => {
          // Arrange
          const sides = layoutSides('movedcut', COPIES, GADGETS)
          const withoutDropped = layoutSides(
            'movedcut',
            COPIES - 1,
            GADGETS
          ).other
          const sut = mergeOrderedArrays
          const start = performance.now()

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)
          const elapsed = performance.now() - start

          // Assert
          expect(result).toStrictEqual(noConflict(wrap(withoutDropped)))
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        GRID_TIMEOUT_MS
      )
    })
  })

  describe('given the identical grid at r = 2, m = 3', () => {
    describe('when merging', () => {
      it('then the whole-array conflict equals the per-reading merge', () => {
        // Arrange
        const sides = gridSides('identical', 2, 3)
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(wholeArrayConflict(sides))
        expect(result).toStrictEqual(
          referenceMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
        )
      })
    })
  })

  describe('given the dropone grid at r = 3, m = 3', () => {
    describe('when merging its 27 readings', () => {
      it('then they render one output without conflict, as the per-reading merge', () => {
        // Arrange
        const sides = gridSides('dropone', 3, 3)
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result).toStrictEqual(
          referenceMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
        )
      })
    })
  })

  describe.each([
    [
      'a zero-swap reading behind one that swaps and conflicts',
      'A A',
      'A A A B',
      'B B',
      'B,A,B (clean)',
    ],
    [
      'every tied reading swaps',
      'A A',
      'A A* A',
      'A A* A* A*',
      '<A,A*,A|A,A|A,A*,A*,A*>',
    ],
    [
      'tied readings that render one output with a conflict',
      'B A A C',
      'B C',
      'B A* C',
      'B,<∅|A,A|A*>,C',
    ],
    [
      'tied clean readings that render different outputs',
      'B A A C',
      'B A C',
      'B A A* A C',
      'B,<A|A,A|A,A*,A>,C',
    ],
    [
      'zero-swap readings after one that swaps, the last conflicting',
      'A A',
      'A A A B',
      'A B B',
      '<A,A,A,B|A,A|A,B,B>',
    ],
    [
      'a lone reading with a conflict',
      'A B C',
      'A X B C',
      'A B X C',
      'A,<X,B|B|B,X>,C',
    ],
  ])('given %s', (_name, ancestor, local, other, expected) => {
    describe('when merging', () => {
      it('then the result is the per-reading merge', () => {
        // Arrange
        const sides = orderedSides(ancestor, local, other)
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(formatResult(result)).toBe(expected)
        expect(result).toStrictEqual(
          referenceMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
        )
      })
    })
  })

  // Tied readings that differ only in which identical copy a side keeps, and
  // whose outputs still differ: merging one of them for all, or stopping once
  // the first ones agree, would not return these results.
  describe.each([
    [
      'an insertion placed before or after the kept copy',
      'A A',
      'A',
      'A X A',
      '<A|A,A|A,X,A>',
    ],
    [
      'a dropped copy joining the block before or after it',
      'P K K Q',
      'K',
      'P* K K Q*',
      '<K|P,K,K,Q|P*,K,K,Q*>',
    ],
    [
      'the nested merge on either inserted copy',
      'U',
      'U K* K*',
      'U* K',
      '<U,K*,K*|U|U*,K>',
    ],
    [
      "a replacement taking the dropped copy's place in some readings only",
      'K K K U',
      'J K U J*',
      'U K K K',
      '<J,K,U,J*|K,K,K,U|U,K,K,K>',
    ],
    [
      'one repeated key after a dropped copy that changes blocks halfway through the readings',
      'P K K Q T R R',
      'K T R',
      'P* K K Q* R R T',
      '<K,T,R|P,K,K,Q,T,R,R|P*,K,K,Q*,R,R,T>',
    ],
    [
      'two repeated keys after a dropped copy that changes blocks halfway through the readings',
      'P K K Q T R R S S',
      'K T R S',
      'P* K K Q* R R S S T',
      '<K,T,R,S|P,K,K,Q,T,R,R,S,S|P*,K,K,Q*,R,R,S,S,T>',
    ],
  ])(
    'given tied readings with %s',
    (_name, ancestor, local, other, expected) => {
      describe('when merging', () => {
        it('then the result is the whole-array conflict, as the tie-scan merge builds', () => {
          // Arrange
          const sides = orderedSides(ancestor, local, other)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(formatResult(result)).toBe(expected)
          expect(result).toStrictEqual(wholeArrayConflict(sides))
          expect(result).toStrictEqual(
            tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
          )
        })
      })
    }
  )

  describe.each([
    [
      'an insertion on the keeping side after the copies',
      'K K U',
      'K U',
      'K K Z U',
      'K,Z,U (clean)',
    ],
    [
      'an insertion on the keeping side before the copies',
      'U K K',
      'U K',
      'U Z K K',
      'U,Z,K (clean)',
    ],
    [
      'an interchangeable neighbour the keeping side drops whole',
      'K K J J U',
      'K J J U',
      'K K Z U',
      'K,Z,U (clean)',
    ],
    [
      'two adjacent interchangeable keys of three copies',
      'K K K J J J V',
      'K K J J J V',
      'K K K J V',
      'K,K,J,V (clean)',
    ],
    [
      'neighbours edited by either side',
      'K K U V',
      'U* K V',
      'K K U V*',
      'U*,K,V* (clean)',
    ],
    [
      'a neighbour the keeping side edits',
      'K K U',
      'K U',
      'K K U*',
      'K,U* (clean)',
    ],
    [
      'a neighbour the keeping side writes with its fields reordered',
      'K K U',
      'K U',
      'K K U^',
      'K,U^ (clean)',
    ],
    [
      'a fixed tied key beside the interchangeable one',
      'K K T T U',
      'K K X T U',
      'K T T U',
      'K,X,T,U (clean)',
    ],
    [
      'an insertion both sides made beside the copies on one side only',
      'K K U V',
      'K U Z V',
      'K K Z U V',
      '<K,U,Z,V|K,K,U,V|K,K,Z,U,V>',
    ],
    [
      'a neighbour both sides edit apart',
      'K K U',
      'K U*',
      'K K U+',
      'K,<U*|U|U+>',
    ],
    [
      'the keeping side moving the copies past their neighbours',
      'K K U V',
      'K U V',
      'U V K K',
      '<K,U,V|K,K,U,V|U,V,K,K>',
    ],
    [
      "the keeping side moving one key's copies ahead of another's",
      'R0 R0 R0 R1 R1',
      'R0 R0 R0 R1',
      'R1 R1 R0 R0 R0',
      '<R0,R0,R0,R1|R0,R0,R0,R1,R1|R1,R1,R0,R0,R0>',
    ],
    [
      'a key inserted twice on one side beside a dropped copy, interchangeable copies after it',
      'P b b Q K K V',
      'a P a b Q K V',
      'P b b Q a K K V',
      '<a,P,a,b,Q,K,V|P,b,b,Q,K,K,V|P,b,b,Q,a,K,K,V>',
    ],
    [
      'two repeated keys after a dropped copy, one interchangeable',
      'P K K Q T R R S S',
      'K T R S',
      'P* K K Q* R R S S T',
      '<K,T,R,S|P,K,K,Q,T,R,R,S,S|P*,K,K,Q*,R,R,S,S,T>',
    ],
    [
      'a dropped copy whose twin on the keeping side lists its fields in another order',
      'K K U',
      'K U',
      'K^ K U',
      '<K,U|K,K,U|K^,K,U>',
    ],
    [
      'a kept copy whose twin on the keeping side lists its fields in another order',
      'K K U',
      'K U',
      'K K^ U',
      '<K,U|K,K,U|K,K^,U>',
    ],
    [
      'interchangeable copies in a part between cuts',
      'K K U L L',
      'K U T T L',
      'K K U T T L L',
      'K,U,T,T,L (clean)',
    ],
  ])(
    'given tied readings that exchange interchangeable copies with %s',
    (_name, ancestor, local, other, expected) => {
      describe('when merging', () => {
        it('then the result is the merge before grouping', () => {
          // Arrange
          const sides = orderedSides(ancestor, local, other)
          const expectedResult = streamMerge(
            sides,
            ORDERED_ATTRIBUTE,
            defaultConfig
          )
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(formatResult(result)).toBe(expected)
          expect(result).toStrictEqual(expectedResult)
          expect(jsonIdentical(result.output, expectedResult.output)).toBe(true)
        })
      })
    }
  )

  describe('given the nocut-dropone layout at r = 3, m = 3', () => {
    describe('when merging', () => {
      it('then the result is the local side with the last entry of the other, as the merge before grouping', () => {
        // Arrange
        const sides = layoutSides('nocut-dropone', 3, 3)
        const expected = streamMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(
          noConflict(
            wrap([...sides.local, sides.other[sides.other.length - 1]])
          )
        )
        expect(result).toStrictEqual(expected)
        expect(jsonIdentical(result.output, expected.output)).toBe(true)
      })
    })
  })

  describe('given the movedcut layout at r = 2, m = 2', () => {
    describe('when merging', () => {
      it('then the result is the other side drawn with one copy fewer, as the merge before grouping', () => {
        // Arrange
        const sides = layoutSides('movedcut', 2, 2)
        const expected = streamMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
        // The other side's order with each key's dropped copy gone is that
        // layout drawn with one copy fewer
        const withoutDropped = layoutSides('movedcut', 1, 2).other
        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(noConflict(wrap(withoutDropped)))
        expect(result).toStrictEqual(expected)
        expect(jsonIdentical(result.output, expected.output)).toBe(true)
      })
    })
  })
})

const EDIT_SUFFIX = /[*+]+$/

type Names = Readonly<Record<string, string>>

// Tokens ('~a' keyless) and the stems of the entry values they stand for
const RENAMED_KEYS: Names = {
  A: 'Q',
  B: 'R',
  X: 'Y',
  a: 'q',
  b: 'r',
  '~a': '~q',
  '~b': '~r',
}

// Every name prefixed: first appearance and alphabetical order are kept. The
// label stems 'a' to 'h' are those of the keyless tokens.
const CUT_RENAMED_KEYS: Names = {
  A: 'RA',
  B: 'RB',
  X: 'RX',
  C0: 'RC0',
  C1: 'RC1',
  D: 'RD',
  E: 'RE',
  F: 'RF',
  G: 'RG',
  H: 'RH',
  I: 'RI',
  '~a': '~ra',
  '~b': '~rb',
  '~d': '~rd',
  '~e': '~re',
  '~g': '~rg',
  '~h': '~rh',
  a: 'ra',
  b: 'rb',
  d: 'rd',
  e: 're',
  g: 'rg',
  h: 'rh',
}

const SECOND_KEYS: Names = {
  A: 'C',
  B: 'D',
  X: 'E',
  '~a': '~c',
  '~b': '~d',
}

// A token or a value, edit marks kept: 'A*' becomes 'Q*'
const renamed = (names: Names, name: string): string => {
  const stem = name.replace(EDIT_SUFFIX, '')
  return `${names[stem]}${name.slice(stem.length)}`
}

const renamedCase = (names: Names, [ancestor, local, other]: Case): Case => {
  const rename = (token: string): string => renamed(names, token)
  return [ancestor.map(rename), local.map(rename), other.map(rename)]
}

const NAMED_FIELDS: ReadonlySet<string> = new Set(['fullName', 'label'])

const relabeled = (names: Names, value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(item => relabeled(names, item))
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([field, content]) => [
      field,
      NAMED_FIELDS.has(field) && typeof content === 'string'
        ? renamed(names, content)
        : relabeled(names, content),
    ])
  )
}

const expectRelabeled = (tokens: Case, names: Names): void => {
  // Arrange
  const sut = mergeOrderedArrays
  const original = sut(sidesOfCase(tokens), ORDERED_ATTRIBUTE, defaultConfig)

  // Act
  const result = sut(
    sidesOfCase(renamedCase(names, tokens)),
    ORDERED_ATTRIBUTE,
    defaultConfig
  )

  // Assert
  expect(result.hasConflict).toBe(original.hasConflict)
  expect(result.output).toEqual(relabeled(names, original.output))
}

const SEPARATOR_TOKEN = 'Z'

const aroundSeparator = (first: Case, second: Case): Case => [
  [...first[0], SEPARATOR_TOKEN, ...second[0]],
  [...first[1], SEPARATOR_TOKEN, ...second[1]],
  [...first[2], SEPARATOR_TOKEN, ...second[2]],
]

const EDITED_SEPARATOR_TOKEN = `${SEPARATOR_TOKEN}*`

// Local writes the separator edited; the ancestor and other keep it
const aroundEditedSeparator = (first: Case, second: Case): Case => {
  const [ancestor, , other] = aroundSeparator(first, second)
  const local = [...first[1], EDITED_SEPARATOR_TOKEN, ...second[1]]
  return [ancestor, local, other]
}

// The precondition of the concatenation law: the readings that survive the
// swap count render one output, so that the case has no whole-array fallback
const rendersOneOutput = (tokens: Case): boolean => {
  const sides = sidesOfCase(tokens)
  const merged = [
    ...identityTies(
      sides.ancestor,
      sides.local,
      sides.other,
      sides.keys
    ).readings(),
  ].map(reading => mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig))
  const swaps = merged.map(reading => reading.phantomSwaps())
  const fewest = merged.filter((_, at) => swaps[at] === Math.min(...swaps))
  return fewest.every(reading =>
    jsonIdentical(reading.output, fewest[0].output)
  )
}

describe('mergeOrderedArrays laws', () => {
  describe('given a case and the same case with every name relabeled', () => {
    describe('when merging both', () => {
      it('then the result is the original one under the new names', () => {
        fc.assert(
          fc.property(
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            tokens => expectRelabeled(tokens, RENAMED_KEYS)
          )
        )
      })

      it('then the result holds across the cuts of a case with several parts', () => {
        fc.assert(
          fc.property(
            cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            tokens => expectRelabeled(tokens, CUT_RENAMED_KEYS)
          )
        )
      })
    })
  })

  describe('given two cases with disjoint keys around a separator', () => {
    describe('when each part renders one output', () => {
      it('then the result is the two merges around the separator', () => {
        fc.assert(
          fc.property(
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            (first, unrenamed) => {
              // Arrange
              const second = renamedCase(SECOND_KEYS, unrenamed)
              fc.pre(rendersOneOutput(first) && rendersOneOutput(second))
              const sut = mergeOrderedArrays
              const merge = (tokens: Case) =>
                sut(sidesOfCase(tokens), ORDERED_ATTRIBUTE, defaultConfig)
              const [before, after] = [merge(first), merge(second)]

              // Act
              const result = merge(aroundSeparator(first, second))

              // Assert
              expect(result.hasConflict).toBe(
                before.hasConflict || after.hasConflict
              )
              expect(result.output).toEqual([
                ...before.output,
                { [ORDERED_ATTRIBUTE]: toEntry(SEPARATOR_TOKEN) },
                ...after.output,
              ])
            }
          )
        )
      })
    })

    describe('when local edits the separator and each part renders one output', () => {
      it("then the result is the two merges around local's separator", () => {
        fc.assert(
          fc.property(
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
            (first, unrenamed) => {
              // Arrange
              const second = renamedCase(SECOND_KEYS, unrenamed)
              fc.pre(rendersOneOutput(first) && rendersOneOutput(second))
              const sut = mergeOrderedArrays
              const merge = (tokens: Case) =>
                sut(sidesOfCase(tokens), ORDERED_ATTRIBUTE, defaultConfig)
              const [before, after] = [merge(first), merge(second)]

              // Act
              const result = merge(aroundEditedSeparator(first, second))

              // Assert
              expect(result.hasConflict).toBe(
                before.hasConflict || after.hasConflict
              )
              expect(result.output).toEqual([
                ...before.output,
                { [ORDERED_ATTRIBUTE]: toEntry(EDITED_SEPARATOR_TOKEN) },
                ...after.output,
              ])
            }
          )
        )
      })
    })
  })

  describe.each([2, 3, 4, 5])('given the grids at r = %i', copies => {
    describe.each([1, 12, 40])('and m = %i', keys => {
      describe('when merging the identical grid', () => {
        it('then the result is the whole-array conflict', () => {
          // Arrange
          const sides = gridSides('identical', copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(wholeArrayConflict(sides))
        })
      })

      describe('when merging the editedcut layout', () => {
        it('then the result is the local side with the last entry of the other', () => {
          // Arrange
          const sides = layoutSides('editedcut', copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(
            noConflict(
              wrap([...sides.local, sides.other[sides.other.length - 1]])
            )
          )
        })
      })

      describe('when merging the nocut-identical layout', () => {
        it('then the result is the whole-array conflict', () => {
          // Arrange
          const sides = layoutSides('nocut-identical', copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(wholeArrayConflict(sides))
        })
      })

      describe('when merging the dropone grid', () => {
        it('then the result is the local side with the last entry of the other', () => {
          // Arrange
          const sides = shapeSides('dropone', copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(
            noConflict(
              wrap([...sides.local, sides.other[sides.other.length - 1]])
            )
          )
        })
      })

      describe('when merging the nocut-dropone layout', () => {
        it('then the result is the local side with the last entry of the other', () => {
          // Arrange
          const sides = layoutSides('nocut-dropone', copies, keys)
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(
            noConflict(
              wrap([...sides.local, sides.other[sides.other.length - 1]])
            )
          )
        })
      })

      describe('when merging the movedcut layout', () => {
        it("then the result is the other side with each repeated key's dropped copy gone", () => {
          // Arrange
          const sides = layoutSides('movedcut', copies, keys)
          const withoutDropped = layoutSides('movedcut', copies - 1, keys).other
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(noConflict(wrap(withoutDropped)))
        })
      })

      describe.each(['floorIdentical', 'swapgrow'] as const)(
        'when merging the %s grid',
        shape => {
          it('then the result is the whole-array conflict', () => {
            // Arrange
            const sides = shapeSides(shape, copies, keys)
            const sut = mergeOrderedArrays

            // Act
            const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

            // Assert
            expect(result).toStrictEqual(wholeArrayConflict(sides))
          })
        }
      )

      describe('when merging the distinct grid', () => {
        it('then the result is its one reading merged', () => {
          // Arrange
          const sides = gridSides('distinct', copies, keys)
          const [reading] = identityTies(
            sides.ancestor,
            sides.local,
            sides.other,
            sides.keys
          ).readings()
          const { output, hasConflict } = mergeReading(
            reading,
            ORDERED_ATTRIBUTE,
            defaultConfig
          )
          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual({ output, hasConflict })
        })
      })
    })
  })
})
