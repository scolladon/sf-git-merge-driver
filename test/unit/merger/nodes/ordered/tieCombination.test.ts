import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { buildConflictMarkers } from '../../../../../src/merger/ConflictMarkerBuilder.js'
import type { MergedReading } from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import {
  combineReadings,
  fewestPhantomSwaps,
  TieScan,
  trimmedBlock,
} from '../../../../../src/merger/nodes/ordered/tieCombination.js'
import type {
  JsonArray,
  JsonObject,
} from '../../../../../src/types/jsonTypes.js'
import {
  type MergeResult,
  noConflict,
  withConflict,
} from '../../../../../src/types/mergeResult.js'
import { TieScan as FullTieScan } from '../../../../utils/oracles/tieScanMerge.js'
import { ORDERED_ATTRIBUTE, toEntry } from '../../../../utils/orderedTokens.js'

// A spread passes one argument per reading and overflows the stack from about
// 100 000 of them: twice that leaves room for any depth the runner adds.
const READINGS = 200_000

// Coverage and mutation runs slow the merge code several-fold.
const LARGE_TIMEOUT_MS = 120_000

const ITEM: JsonObject = { [ORDERED_ATTRIBUTE]: toEntry('R') }

const ZERO_SWAP_READING: MergedReading = {
  output: [ITEM],
  hasConflict: false,
  phantomSwaps: () => 0,
}

describe('fewestPhantomSwaps', () => {
  describe('given more zero-swap readings than a spread can pass', () => {
    describe('when keeping the readings with the fewest swaps', () => {
      it(
        'then every reading is kept',
        () => {
          // Arrange
          const merged = Array.from(
            { length: READINGS },
            () => ZERO_SWAP_READING
          )
          const sut = fewestPhantomSwaps

          // Act
          const result = sut(merged)

          // Assert
          expect(result).toHaveLength(READINGS)
        },
        LARGE_TIMEOUT_MS
      )
    })
  })
})

describe('fewestPhantomSwaps', () => {
  describe('given a lone reading', () => {
    describe('when keeping the readings with the fewest swaps', () => {
      it('then it is kept without measuring its swaps', () => {
        // Arrange
        const lone = {
          output: [ITEM],
          hasConflict: false,
          phantomSwaps: vi.fn(() => 0),
        }
        const sut = fewestPhantomSwaps

        // Act
        const result = sut([lone])

        // Assert
        expect(result).toStrictEqual([noConflict([ITEM])])
        expect(lone.phantomSwaps).not.toHaveBeenCalled()
      })
    })
  })
})

describe('trimmedBlock', () => {
  describe('given more outputs than a spread can pass', () => {
    describe('when building the block', () => {
      it(
        'then the block holds what the outputs and both sides do not share',
        () => {
          // Arrange
          const outputs = Array.from({ length: READINGS }, (_, at) =>
            at === 0 ? [ITEM, ITEM] : [ITEM]
          )
          const wrapped = {
            ancestor: [ITEM],
            local: [ITEM, ITEM],
            other: [ITEM],
          }
          const sut = trimmedBlock

          // Act
          const result = sut(wrapped, outputs)

          // Assert
          expect(result).toStrictEqual(
            withConflict([ITEM, buildConflictMarkers([ITEM], [], [])])
          )
        },
        LARGE_TIMEOUT_MS
      )
    })
  })
})

const itemOf = (token: string): JsonObject => ({
  [ORDERED_ATTRIBUTE]: toEntry(token),
})

const readingOf = (
  output: JsonArray,
  { hasConflict = false, swaps = 0 } = {}
) => ({ output, hasConflict, phantomSwaps: vi.fn(() => swaps) })

// Readings compete from two on: a lone one is never measured.
const FEWEST_COMPETING_READINGS = 2

// Two swaps leave room for a reading beaten by one that is itself beaten.
const MOST_SWAPS = 2

// A tie set holds at least one reading; eight leave room for several lowerings
// of the least count within one stream.
const FEWEST_READINGS = 1
const MOST_READINGS = 8

const readingShape = fc.record({
  swaps: fc.integer({ min: 0, max: MOST_SWAPS }),
  hasConflict: fc.boolean(),
  output: fc.constantFrom<JsonArray>(
    [itemOf('A')],
    [itemOf('B')],
    [itemOf('A'), itemOf('B')]
  ),
})

type ReadingShape = { swaps: number; hasConflict: boolean; output: JsonArray }

// Each scan measures its own copies, so the call counts stay its own
const readingsOf = (shapes: readonly ReadingShape[]) =>
  shapes.map(({ output, ...shape }) => readingOf(output, shape))

const flagsOf = (
  scan: Pick<TieScan, 'add' | 'isWholeConflict'>,
  readings: readonly MergedReading[]
): readonly boolean[] =>
  readings.map(reading => {
    scan.add(reading)
    return scan.isWholeConflict()
  })

describe('TieScan', () => {
  describe.each([
    [
      'two readings without swaps that differ, the first conflicting',
      [
        readingOf([itemOf('A')], { hasConflict: true }),
        readingOf([itemOf('B')]),
      ],
      true,
    ],
    [
      'two readings without swaps that differ, the second conflicting',
      [
        readingOf([itemOf('A')]),
        readingOf([itemOf('B')], { hasConflict: true }),
      ],
      true,
    ],
    [
      'three readings without swaps, the last one differing and conflicting',
      [
        readingOf([itemOf('A')]),
        readingOf([itemOf('A')]),
        readingOf([itemOf('B')], { hasConflict: true }),
      ],
      true,
    ],
    [
      'two readings without swaps that differ without conflict',
      [readingOf([itemOf('A')]), readingOf([itemOf('B')])],
      false,
    ],
    [
      'two readings without swaps that conflict alike',
      [
        readingOf([itemOf('A')], { hasConflict: true }),
        readingOf([itemOf('A')], { hasConflict: true }),
      ],
      false,
    ],
    [
      'a conflicting reading that differs but swaps copies',
      [
        readingOf([itemOf('A')]),
        readingOf([itemOf('B')], { hasConflict: true, swaps: 1 }),
      ],
      false,
    ],
  ])('given %s', (_name, readings, expected) => {
    describe('when scanning them', () => {
      it('then the whole array conflicts only when they differ and conflict', () => {
        // Arrange
        const sut = new TieScan()

        // Act
        for (const reading of readings) sut.add(reading)

        // Assert
        expect(sut.isWholeConflict()).toBe(expected)
        expect(sut.results()).toEqual(fewestPhantomSwaps(readings))
      })
    })
  })

  describe('given a lone reading', () => {
    describe('when scanning it', () => {
      it('then its swaps are never measured', () => {
        // Arrange
        const lone = readingOf([itemOf('A')], { hasConflict: true })
        const sut = new TieScan()

        // Act
        sut.add(lone)

        // Assert
        expect(lone.phantomSwaps).not.toHaveBeenCalled()
        expect(sut.isWholeConflict()).toBe(false)
      })

      it('then its result is kept without measuring its swaps', () => {
        // Arrange
        const lone = readingOf([itemOf('A')], { hasConflict: true })
        const sut = new TieScan()
        sut.add(lone)

        // Act
        const result = sut.results()

        // Assert
        expect(result).toStrictEqual([withConflict([itemOf('A')])])
        expect(lone.phantomSwaps).not.toHaveBeenCalled()
      })
    })
  })

  describe('given readings with two, none and one swaps of distinct outputs', () => {
    describe('when scanning them', () => {
      it('then only the result of the reading without swaps is kept', () => {
        // Arrange
        const sut = new TieScan()
        sut.add(readingOf([itemOf('A')], { swaps: 2 }))
        sut.add(readingOf([itemOf('B')], { swaps: 0 }))
        sut.add(readingOf([itemOf('C')], { swaps: 1 }))

        // Act
        const result = sut.results()

        // Assert
        expect(result).toStrictEqual([noConflict([itemOf('B')])])
      })
    })
  })

  describe('given two readings tied at one swap', () => {
    describe('when scanning them', () => {
      it('then both results are kept in order', () => {
        // Arrange
        const sut = new TieScan()
        sut.add(readingOf([itemOf('A')], { swaps: 1 }))
        sut.add(readingOf([itemOf('B')], { swaps: 1 }))

        // Act
        const result = sut.results()

        // Assert
        expect(result).toStrictEqual([
          noConflict([itemOf('A')]),
          noConflict([itemOf('B')]),
        ])
      })
    })
  })

  describe('given any stream of merged readings', () => {
    describe('when scanning it', () => {
      it('then it flags and keeps what the scan of every reading does, measuring each once', () => {
        fc.assert(
          fc.property(
            fc.array(readingShape, {
              minLength: FEWEST_READINGS,
              maxLength: MOST_READINGS,
            }),
            shapes => {
              // Arrange
              const readings = readingsOf(shapes)
              const expectedFlags = flagsOf(
                new FullTieScan(),
                readingsOf(shapes)
              )
              const expected = fewestPhantomSwaps(readingsOf(shapes))
              const sut = new TieScan()

              // Act
              const flags = flagsOf(sut, readings)

              // Assert
              expect(flags).toStrictEqual(expectedFlags)
              expect(sut.results()).toEqual(expected)
              for (const reading of readings)
                expect(reading.phantomSwaps).toHaveBeenCalledTimes(
                  readings.length >= FEWEST_COMPETING_READINGS ? 1 : 0
                )
            }
          )
        )
      })
    })
  })
})

describe('combineReadings', () => {
  describe('given results that differ, only one of them conflicting', () => {
    describe('when combining them', () => {
      it('then the whole array conflicts rather than the differing middle', () => {
        // Arrange
        const wrapped = {
          ancestor: [itemOf('H')],
          local: [itemOf('H'), itemOf('A')],
          other: [itemOf('H'), itemOf('B')],
        }
        const results: MergeResult[] = [
          noConflict([itemOf('H'), itemOf('A')]),
          withConflict([itemOf('H'), itemOf('B')]),
        ]
        const sut = combineReadings

        // Act
        const result = sut(() => wrapped, results)

        // Assert
        expect(result).toStrictEqual(
          withConflict([
            buildConflictMarkers(
              wrapped.local,
              wrapped.ancestor,
              wrapped.other
            ),
          ])
        )
      })
    })
  })

  describe('given results that render alike', () => {
    describe('when combining them', () => {
      it('then the first result comes back and the sides are never wrapped', () => {
        // Arrange
        const wrap = vi.fn()
        const results: MergeResult[] = [
          noConflict([itemOf('H'), itemOf('A')]),
          noConflict([itemOf('H'), itemOf('A')]),
        ]
        const sut = combineReadings

        // Act
        const result = sut(wrap, results)

        // Assert
        expect(result).toBe(results[0])
        expect(wrap).not.toHaveBeenCalled()
      })
    })
  })

  describe('given clean results that differ past a shared head', () => {
    describe('when combining them', () => {
      it('then the sides are wrapped once for the trimmed block', () => {
        // Arrange
        const wrapped = {
          ancestor: [itemOf('H')],
          local: [itemOf('H'), itemOf('A')],
          other: [itemOf('H'), itemOf('B')],
        }
        const wrap = vi.fn(() => wrapped)
        const results: MergeResult[] = [
          noConflict([itemOf('H'), itemOf('A'), itemOf('B')]),
          noConflict([itemOf('H'), itemOf('B'), itemOf('A')]),
        ]
        const sut = combineReadings

        // Act
        const result = sut(wrap, results)

        // Assert
        expect(result).toStrictEqual(
          withConflict([
            itemOf('H'),
            buildConflictMarkers([itemOf('A')], [], [itemOf('B')]),
          ])
        )
        expect(wrap).toHaveBeenCalledTimes(1)
      })
    })
  })
})
