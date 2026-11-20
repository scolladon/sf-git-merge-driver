import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  mergeOrderedArrays,
  mergeReading,
} from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { jsonEqual } from '../../../../../src/utils/jsonEqual.js'
import {
  type Case,
  caseArb,
  SMALL,
  SMALL_ANCESTORS,
  type Tokens,
} from '../../../../utils/orderedCases.js'
import {
  ORDERED_ATTRIBUTE,
  orderedSides,
  readingsOf,
} from '../../../../utils/orderedTokens.js'
import {
  oracleReadings,
  readingSignatures,
} from '../../../../utils/readingOracle.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

const joined = (tokens: Tokens): string => tokens.join(' ')

const mergeCase = ([ancestor, local, other]: Case) =>
  mergeOrderedArrays(
    orderedSides(joined(ancestor), joined(local), joined(other)),
    ORDERED_ATTRIBUTE,
    defaultConfig
  )

const srcReadings = ([ancestor, local, other]: Case) =>
  readingsOf(joined(ancestor), joined(local), joined(other))

const oracleOf = ([ancestor, local, other]: Case) =>
  oracleReadings(ancestor, local, other)

// A side that is the ancestor or the other side is taken whole (no reading
// is consulted), so the "every reading agrees" claim does not apply to it.
const takenWhole = ([ancestor, local, other]: Case): boolean =>
  joined(local) === joined(other) ||
  joined(ancestor) === joined(local) ||
  joined(ancestor) === joined(other)

// Readings that only work by swapping interchangeable copies are not readings
// (ADR 068): only the ones with the fewest such swaps must agree.
const countingReadings = (sides: Case) => {
  const merged = oracleOf(sides).map(reading =>
    mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig)
  )
  const swaps = merged.map(result => result.phantomSwaps())
  const fewest = Math.min(...swaps)
  return merged.filter((_, index) => swaps[index] === fewest)
}

// Short ancestors with repeated identical values, where a block's head and
// tail can overlap inside the ancestor
const WIDE = { length: 4, perKey: { A: 3, B: 2, X: 1 } }
const WIDE_ANCESTORS: readonly Tokens[] = [
  ['A', 'A'],
  ['A', 'A', 'A'],
  ['A', 'B', 'A', 'B'],
  ['A', 'A*', 'A'],
  ['B', 'A', 'A'],
  ['A'],
]

// Independent random sides rarely share an identity, so few cases have
// several readings: these are the cases the claims are about.
const severalReadings = (arbitrary: fc.Arbitrary<Case>): fc.Arbitrary<Case> =>
  arbitrary.filter(sides => oracleOf(sides).length > 1)

const SCENARIOS: readonly (readonly [string, fc.Arbitrary<Case>])[] = [
  ['two repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
  [
    'two repeated keys with several readings',
    severalReadings(caseArb(SMALL_ANCESTORS, SMALL)),
  ],
  ['short ancestors of identical values', caseArb(WIDE_ANCESTORS, WIDE)],
]

const Q6_ROWS: readonly (readonly [string, string, string, string, number])[] =
  [
    ['a value dropped and an entry edited', 'A B A', 'A', 'A*', 4],
    ['fewest moves pick the copies', 'A B A', 'A B', 'A* B A', 1],
    ['each side keeps a different copy', 'A B A', 'A B', 'B A', 2],
    ['one side adds a key', 'A B A', 'A', 'A X', 2],
    ['three entries rotate', 'A B C A', 'A B C', 'C A B', 1],
    ['keyless entries', '~a ~a ~b', '~a ~b', '~a ~a ~b*', 2],
    ['unique keys reorder', 'A B C', 'B A C', 'A C B', 1],
    ['surplus copies on the longer side', '', '~p', '~p ~p', 2],
    ['surplus copies on the longer side, mirrored', '', '~p ~p', '~p', 2],
  ]

const tokensOf = (side: string): Tokens => (side === '' ? [] : side.split(' '))

describe('identity readings', () => {
  describe.each(Q6_ROWS)(
    'given %s',
    (_name, ancestor, local, other, expected) => {
      const row: Case = [tokensOf(ancestor), tokensOf(local), tokensOf(other)]

      it('then the written rules find the expected number of readings', () => {
        // Arrange
        const sut = oracleOf

        // Act
        const result = sut(row)

        // Assert
        expect(result).toHaveLength(expected)
      })

      it('then identify finds the same readings', () => {
        // Arrange
        const sut = srcReadings

        // Act
        const result = sut(row)

        // Assert
        expect(readingSignatures(result)).toEqual(
          readingSignatures(oracleOf(row))
        )
      })
    }
  )

  describe.each(SCENARIOS)('given %s', (_name, arbitrary) => {
    describe('when the readings are enumerated', () => {
      it('then identify yields exactly the readings the rules allow', () => {
        // Arrange
        const sut = srcReadings

        // Act / Assert
        fc.assert(
          fc.property(arbitrary, sides => {
            expect(readingSignatures(sut(sides))).toEqual(
              readingSignatures(oracleOf(sides))
            )
          })
        )
      })
    })

    describe('when the sides are merged', () => {
      it('then a clean merge is what every counting reading yields, cleanly', () => {
        // Arrange
        const sut = mergeCase

        // Act / Assert
        fc.assert(
          fc.property(arbitrary, sides => {
            const merged = sut(sides)
            fc.pre(!merged.hasConflict && !takenWhole(sides))
            for (const result of countingReadings(sides)) {
              expect(result.hasConflict).toBe(false)
              expect(jsonEqual(result.output, merged.output)).toBe(true)
            }
          })
        )
      })

      it('then counting readings that all agree cleanly never conflict', () => {
        // Arrange
        const sut = mergeCase

        // Act / Assert
        fc.assert(
          fc.property(arbitrary, sides => {
            const results = countingReadings(sides)
            const [first] = results
            const agree = results.every(
              result =>
                !result.hasConflict &&
                jsonEqual(result.output, (first as typeof result).output)
            )
            fc.pre(agree)
            expect(sut(sides).hasConflict).toBe(false)
          })
        )
      })
    })
  })
})
