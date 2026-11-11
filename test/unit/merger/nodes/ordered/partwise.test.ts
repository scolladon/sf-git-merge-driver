import { describe, expect, it, vi } from 'vitest'
import { buildConflictMarkers } from '../../../../../src/merger/ConflictMarkerBuilder.js'
import {
  type IdentityTies,
  identityTies,
} from '../../../../../src/merger/nodes/ordered/identity.js'
import type { Tuple } from '../../../../../src/merger/nodes/ordered/identityComponents.js'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import {
  type MergedReading,
  mergeReading,
} from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import type { Reading } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import { mergePartwise } from '../../../../../src/merger/nodes/ordered/partwise.js'
import { tiePartsOf } from '../../../../../src/merger/nodes/ordered/tieParts.js'
import type {
  JsonArray,
  JsonObject,
} from '../../../../../src/types/jsonTypes.js'
import {
  type MergeResult,
  noConflict,
  withConflict,
} from '../../../../../src/types/mergeResult.js'
import { mergeOrderedArrays as tieScanMerge } from '../../../../utils/oracles/tieScanMerge.js'
import { layoutSides, shapeSides } from '../../../../utils/orderedCuts.js'
import {
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
  toEntry,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

const wrap = (side: JsonArray): JsonArray =>
  side.map(entry => ({ [ORDERED_ATTRIBUTE]: entry }))

const wholeArrayConflict = (sides: OrderedSides): MergeResult =>
  withConflict([
    buildConflictMarkers(
      wrap(sides.local),
      wrap(sides.ancestor),
      wrap(sides.other)
    ),
  ])

const lastOf = (side: JsonArray) => side[side.length - 1]

const inputOf = (sides: OrderedSides) => {
  const ties = identityTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  )
  const merge = vi.fn((reading: Reading) =>
    mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig)
  )
  const input = {
    wrapped: {
      ancestor: wrap(sides.ancestor),
      local: wrap(sides.local),
      other: wrap(sides.other),
    },
    ties,
    parts: tiePartsOf(sides, ties),
    merge,
  }
  return { input, merge }
}

const oracleOf = (sides: OrderedSides): MergeResult =>
  tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

interface Exit {
  readonly name: string
  readonly sides: () => OrderedSides
  readonly expected: (sides: OrderedSides) => MergeResult
  readonly merges: number
}

const EXITS: readonly Exit[] = [
  {
    name: 'the dropone grid at r = 3, m = 3: every survivor renders alike',
    sides: () => shapeSides('dropone', 3, 3),
    expected: sides => noConflict(wrap([...sides.local, lastOf(sides.other)])),
    merges: 7,
  },
  {
    name: 'the editedcut layout at r = 3, m = 3: every survivor renders alike',
    sides: () => layoutSides('editedcut', 3, 3),
    expected: sides => noConflict(wrap([...sides.local, lastOf(sides.other)])),
    merges: 7,
  },
  {
    name: 'the floorIdentical grid at r = 2, m = 2: a reading of the first round conflicts',
    sides: () => shapeSides('floorIdentical', 2, 2),
    expected: wholeArrayConflict,
    merges: 4,
  },
  {
    name: 'the identical grid at r = 3, m = 3: the readings of one part already differ and conflict',
    sides: () => shapeSides('identical', 3, 3),
    expected: wholeArrayConflict,
    merges: 3,
  },
  {
    name: 'the identical grid at r = 2, m = 2: the first reading and a variation of the first part already differ and conflict',
    sides: () => shapeSides('identical', 2, 2),
    expected: wholeArrayConflict,
    merges: 2,
  },
  {
    name: 'a second part whose conflict shows only around the best readings',
    sides: () => orderedSides('A A C D D', 'A A A B C D* D', 'B B C D'),
    expected: wholeArrayConflict,
    merges: 5,
  },
]

describe.each(EXITS)('given $name', ({ sides, expected, merges }) => {
  describe('when merging the tied parts', () => {
    it('then the result is the whole-array answer', () => {
      // Arrange
      const { input } = inputOf(sides())
      const sut = mergePartwise

      // Act
      const result = sut(input)

      // Assert
      expect(result).toStrictEqual(expected(sides()))
    })

    it('then the result equals the tie-scan merge', () => {
      // Arrange
      const { input } = inputOf(sides())
      const sut = mergePartwise

      // Act
      const result = sut(input)

      // Assert
      expect(result).toStrictEqual(oracleOf(sides()))
    })

    it('then it merges only the readings it needs', () => {
      // Arrange
      const { input, merge } = inputOf(sides())
      const sut = mergePartwise

      // Act
      sut(input)

      // Assert
      expect(merge).toHaveBeenCalledTimes(merges)
    })
  })
})

describe('given a first part whose best reading is not the first one', () => {
  describe('when merging the tied parts', () => {
    const tokens = ['A A C D D D', 'A A A B C D D', 'B B C D D D Z'] as const

    it('then the clean result is the one the tie-scan merge builds', () => {
      // Arrange
      const sides = orderedSides(...tokens)
      const { input } = inputOf(sides)
      const sut = mergePartwise

      // Act
      const result = sut(input)

      // Assert
      expect(formatResult(result)).toBe('B,A,B,C,D,D,Z (clean)')
      expect(result).toStrictEqual(oracleOf(sides))
    })

    it('then it merges the first reading, each variation and each variation around the best', () => {
      // Arrange
      const { input, merge } = inputOf(orderedSides(...tokens))
      const sut = mergePartwise

      // Act
      sut(input)

      // Assert
      expect(merge).toHaveBeenCalledTimes(7)
    })
  })
})

describe('given the dropinsert grid at r = 3, m = 3', () => {
  describe('when merging the tied parts', () => {
    it('then the survivors that differ without conflict come back as the trimmed block', () => {
      // Arrange
      const sides = shapeSides('dropinsert', 3, 3)
      const { input } = inputOf(sides)
      const sut = mergePartwise

      // Act
      const result = sut(input)

      // Assert
      expect(result).toStrictEqual(oracleOf(sides))
      expect(result.hasConflict).toBe(true)
    })

    it('then it merges the readings of the survivors only', () => {
      // Arrange
      const { input, merge } = inputOf(shapeSides('dropinsert', 3, 3))
      const sut = mergePartwise

      // Act
      sut(input)

      // Assert
      expect(merge).toHaveBeenCalledTimes(7)
    })
  })
})

describe('given a last part whose readings merge clean to outputs of different lengths', () => {
  const tokens = ['A A C0 D D D', 'A X A C0 ~d F D D', 'A C0 D D'] as const

  describe('when merging the tied parts', () => {
    it('then the block stops where the readings of that part stop agreeing', () => {
      // Arrange
      const sides = orderedSides(...tokens)
      const { input } = inputOf(sides)
      const sut = mergePartwise

      // Act
      const result = sut(input)

      // Assert
      expect(formatResult(result)).toBe('<A,X,A,C0,~d,F,D|A,A,C0,D,D|A,C0,D>,D')
      expect(result).toStrictEqual(oracleOf(sides))
    })
  })
})

describe('given one tied part', () => {
  describe('when merging', () => {
    it('then the result is the one the tie-scan merge builds', () => {
      // Arrange
      const sides = orderedSides('A A C', 'A C', 'A A C Z')
      const sut = mergeOrderedArrays

      // Act
      const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

      // Assert
      expect(formatResult(result)).toBe('A,C,Z (clean)')
      expect(result).toStrictEqual(oracleOf(sides))
    })
  })
})

describe('given the dropone grid at r = 3, m = 9', () => {
  // 3^9 tied readings take seconds; the partwise merge needs 19. The budget
  // sits between the two so that CPU load and coverage instrumentation cannot
  // push the merge over it.
  const COPIES = 3
  const GADGETS = 9
  const BUDGET_MS = 400
  const GRID_TIMEOUT_MS = 120_000

  describe('when merging', () => {
    it(
      'then the one output comes back within the budget',
      () => {
        // Arrange
        const sides = shapeSides('dropone', COPIES, GADGETS)
        const sut = mergeOrderedArrays
        const start = performance.now()

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)
        const elapsed = performance.now() - start

        // Assert
        expect(result).toStrictEqual(
          noConflict(wrap([...sides.local, lastOf(sides.other)]))
        )
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      GRID_TIMEOUT_MS
    )
  })
})

describe('given the dropinsert grid at r = 3, m = 9', () => {
  // 3^9 tied readings take seconds; the partwise merge needs 19. The budget
  // sits between the two so that CPU load and coverage instrumentation cannot
  // push the merge over it.
  const COPIES = 3
  const GADGETS = 9
  const BUDGET_MS = 400
  const GRID_TIMEOUT_MS = 120_000

  describe('when merging', () => {
    it(
      'then the trimmed block comes back within the budget',
      () => {
        // Arrange
        const sides = shapeSides('dropinsert', COPIES, GADGETS)
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

describe('given the editedcut layout at r = 3, m = 9', () => {
  // 3^9 tied readings take seconds; the partwise merge needs 19. The budget
  // sits between the two so that CPU load and coverage instrumentation cannot
  // push the merge over it.
  const COPIES = 3
  const GADGETS = 9
  const BUDGET_MS = 400
  const GRID_TIMEOUT_MS = 120_000

  describe('when merging', () => {
    it(
      'then the one output comes back within the budget',
      () => {
        // Arrange
        const sides = layoutSides('editedcut', COPIES, GADGETS)
        const sut = mergeOrderedArrays
        const start = performance.now()

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)
        const elapsed = performance.now() - start

        // Assert
        expect(result).toStrictEqual(
          noConflict(wrap([...sides.local, lastOf(sides.other)]))
        )
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      GRID_TIMEOUT_MS
    )
  })
})

describe('given one tied part with more choices than a spread can pass', () => {
  // A spread passes one argument per choice and overflows the stack from about
  // 100 000 of them: twice that leaves room for any depth the runner adds.
  const CHOICES = 200_000
  // Coverage and mutation runs slow the merge code several-fold.
  const LARGE_TIMEOUT_MS = 120_000
  const ITEM: JsonObject = { [ORDERED_ATTRIBUTE]: toEntry('R') }
  const SHORT: MergedReading = {
    output: [ITEM],
    hasConflict: false,
    phantomSwaps: () => 0,
  }
  const LONG: MergedReading = { ...SHORT, output: [ITEM, ITEM] }

  function* choices(): Generator<Tuple> {
    for (let at = 0; at < CHOICES; at++) yield [at]
  }

  const ties: IdentityTies = {
    first: [0],
    components: [],
    readingOf: () => [],
    keyOf: () => 'R',
    readings: () => [],
    around: choices,
  }

  // The first choice renders longer than every other, so the outputs differ
  // without conflict and the merge trims them all.
  const inputWithChoices = () => {
    const merge = vi
      .fn<(reading: Reading) => MergedReading>()
      .mockReturnValueOnce(LONG)
      .mockReturnValue(SHORT)
    const input = {
      wrapped: { ancestor: [ITEM], local: [ITEM, ITEM], other: [ITEM] },
      ties,
      parts: { tied: [[0]] },
      merge,
    }
    return { input, merge }
  }

  describe('when merging the tied parts', () => {
    it(
      'then the trimmed block holds what the outputs and both sides do not share',
      () => {
        // Arrange
        const { input } = inputWithChoices()
        const sut = mergePartwise

        // Act
        const result = sut(input)

        // Assert
        expect(result).toStrictEqual(
          withConflict([ITEM, buildConflictMarkers([ITEM], [], [])])
        )
      },
      LARGE_TIMEOUT_MS
    )

    it(
      'then it merges every choice once',
      () => {
        // Arrange
        const { input, merge } = inputWithChoices()
        const sut = mergePartwise

        // Act
        sut(input)

        // Assert
        expect(merge).toHaveBeenCalledTimes(CHOICES)
      },
      LARGE_TIMEOUT_MS
    )
  })
})

describe('given readings with the same swaps of which one conflicts', () => {
  describe('when merging the tied parts', () => {
    it('then the result is the whole-array conflict', () => {
      // Arrange
      const sides = shapeSides('dropinsert', 3, 3)
      const { input } = inputOf(sides)
      let calls = 0
      const merge = (reading: Reading): MergedReading => ({
        ...mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig),
        hasConflict: calls++ === 1,
        phantomSwaps: () => 1,
      })
      const sut = mergePartwise

      // Act
      const result = sut({ ...input, merge })

      // Assert
      expect(result).toStrictEqual(wholeArrayConflict(sides))
    })
  })
})
