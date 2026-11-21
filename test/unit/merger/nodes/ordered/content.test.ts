import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { MergeOrchestrator } from '../../../../../src/merger/MergeOrchestrator.js'
import {
  mergeEntryContent,
  wrapNonEmpty,
} from '../../../../../src/merger/nodes/entryContent.js'
import { defaultNodeFactory } from '../../../../../src/merger/nodes/MergeNodeFactory.js'
import {
  type EntryMerger,
  type EntryStatus,
  entryStatuses,
  entryStatusesBy,
  rememberingKept,
  type StatusInput,
} from '../../../../../src/merger/nodes/ordered/content.js'
import { identityTies } from '../../../../../src/merger/nodes/ordered/identity.js'
import {
  everyEntry,
  possiblyMoved,
} from '../../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  LIVE_SIDES,
  type LiveSide,
  type Reading,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import type { JsonArray } from '../../../../../src/types/jsonTypes.js'
import type { MergeResult } from '../../../../../src/types/mergeResult.js'
import { entryStatuses as plainStatuses } from '../../../../utils/oracles/plainStatuses.js'
import {
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
  type Tokens,
} from '../../../../utils/orderedCases.js'
import {
  cutCaseArb,
  groupCaseArb,
  stitchedCaseArb,
} from '../../../../utils/orderedCuts.js'
import {
  ORDERED_ATTRIBUTE,
  orderedSides,
  readingsOf,
  toEntry,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'
import {
  contestedSidesArb,
  ordered,
  type Side,
} from '../../laws/arbitraries.js'

const MERGED_OUTPUT = [{ [ORDERED_ATTRIBUTE]: { merged: 'fields' } }]

const mergerReturning = (hasConflict: boolean) =>
  vi.fn<EntryMerger>(
    (): MergeResult => ({ output: MERGED_OUTPUT, hasConflict })
  )

// Built as the reading merge builds it: the statuses read the entries each
// side may have moved
const inputOf = (reading: Reading, mergeEntry: EntryMerger): StatusInput => ({
  reading,
  movedOwn: Object.fromEntries(
    LIVE_SIDES.map(side => [side, possiblyMoved(reading, side, everyEntry)])
  ) as Record<LiveSide, ReadonlySet<number>>,
  attribute: ORDERED_ATTRIBUTE,
  mergeEntry,
})

const statusesOf = (
  ancestor: string,
  local: string,
  other: string,
  mergeEntry: EntryMerger
): readonly EntryStatus[] => {
  const [reading] = readingsOf(ancestor, local, other)
  return entryStatuses(inputOf(reading!, mergeEntry))
}

const nestedMerger = (): EntryMerger => {
  const orchestrator = new MergeOrchestrator(defaultConfig, defaultNodeFactory)
  return (ancestor, local, other) =>
    mergeEntryContent(
      { ancestor, local, other },
      ORDERED_ATTRIBUTE,
      defaultConfig,
      orchestrator,
      wrapNonEmpty
    )
}

const fromTokens = ([ancestor, local, other]: readonly Tokens[]) =>
  orderedSides(ancestor!.join(' '), local!.join(' '), other!.join(' '))

const fromEntries = (sides: readonly Side[]): OrderedSides => {
  const [ancestor, local, other] = sides as readonly JsonArray[]
  return {
    ancestor: ancestor!,
    local: local!,
    other: other!,
    keys: {
      ancestor: ancestor!.map(ordered.keyOf),
      local: local!.map(ordered.keyOf),
      other: other!.map(ordered.keyOf),
    },
  }
}

const everyReading = (sides: OrderedSides): readonly Reading[] => [
  ...identityTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  ).readings(),
]

const settledInTurn = (
  readings: readonly Reading[],
  settle: (input: StatusInput) => readonly EntryStatus[]
): readonly (readonly EntryStatus[])[] => {
  const mergeEntry = nestedMerger()
  return readings.map(reading => settle(inputOf(reading, mergeEntry)))
}

const kinds = (statuses: readonly EntryStatus[]): readonly string[] =>
  statuses.map(status => status.kind)

const wrapped = (token: string) => [{ [ORDERED_ATTRIBUTE]: toEntry(token) }]

describe('entryStatuses', () => {
  describe('given an entry kept by all three sides', () => {
    describe('when only one side edited it', () => {
      it('then it is clean with that side and the merger is not called', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A B', 'A* B', 'A B+', mergeEntry)

        // Assert
        expect(sut).toEqual([
          { kind: 'clean', output: wrapped('A*') },
          { kind: 'clean', output: wrapped('B+') },
        ])
        expect(mergeEntry).not.toHaveBeenCalled()
      })
    })

    describe('when both sides made the same edit', () => {
      it('then it is clean with that edit and the merger is not called', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A', 'A*', 'A*', mergeEntry)

        // Assert
        expect(sut).toEqual([{ kind: 'clean', output: wrapped('A*') }])
        expect(mergeEntry).not.toHaveBeenCalled()
      })
    })

    describe('when both sides edited it differently', () => {
      it('then the merger decides from ancestor, local and other', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A', 'A*', 'A+', mergeEntry)

        // Assert
        expect(sut).toEqual([{ kind: 'clean', output: MERGED_OUTPUT }])
        expect(mergeEntry).toHaveBeenCalledExactlyOnceWith(
          toEntry('A'),
          toEntry('A*'),
          toEntry('A+')
        )
      })
    })

    describe('when the merger reports a conflict', () => {
      it('then it is a content conflict carrying the merger output', () => {
        // Arrange
        const mergeEntry = mergerReturning(true)

        // Act
        const sut = statusesOf('A', 'A*', 'A+', mergeEntry)

        // Assert
        expect(sut).toEqual([
          { kind: 'contentConflict', output: MERGED_OUTPUT },
        ])
      })
    })
  })

  describe('given an entry only the ancestor holds', () => {
    it('then it is gone', () => {
      // Arrange
      const mergeEntry = mergerReturning(false)

      // Act
      const sut = statusesOf('A', '', '', mergeEntry)

      // Assert
      expect(kinds(sut)).toEqual(['gone'])
    })
  })

  describe('given an entry deleted by one side and kept by the other', () => {
    describe('when the keeper edited it', () => {
      it('then it is a presence conflict', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A B', 'B', 'A* B', mergeEntry)

        // Assert
        expect(kinds(sut)).toEqual(['presenceConflict', 'clean'])
      })
    })

    describe('when the keeper left it unchanged and in place', () => {
      it('then it is gone', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A B', 'B', 'A B', mergeEntry)

        // Assert
        expect(kinds(sut)).toEqual(['gone', 'clean'])
      })
    })

    describe('when the keeper moved it', () => {
      it('then it is a presence conflict', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('K B C', 'B C Z', 'B C K', mergeEntry)

        // Assert
        expect(kinds(sut)).toEqual([
          'presenceConflict',
          'clean',
          'clean',
          'clean',
        ])
      })
    })

    describe('when the keeper reordered it among its neighbours', () => {
      it('then it is a presence conflict and the other deletion is gone', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A B C', 'C A', 'C', mergeEntry)

        // Assert
        expect(kinds(sut)).toEqual(['presenceConflict', 'gone', 'clean'])
      })
    })
  })

  describe('given an entry both live sides inserted', () => {
    describe('when their values are equal', () => {
      it('then it is clean and the merger is not called', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('', 'X', 'X', mergeEntry)

        // Assert
        expect(sut).toEqual([{ kind: 'clean', output: wrapped('X') }])
        expect(mergeEntry).not.toHaveBeenCalled()
      })
    })

    describe('when their fields differ', () => {
      it('then the merger decides without an ancestor', () => {
        // Arrange
        const mergeEntry = mergerReturning(false)

        // Act
        const sut = statusesOf('A', 'A B:x', 'A B:y', mergeEntry)

        // Assert
        expect(sut[1]).toEqual({ kind: 'clean', output: MERGED_OUTPUT })
        expect(mergeEntry).toHaveBeenCalledExactlyOnceWith(
          undefined,
          toEntry('B:x'),
          toEntry('B:y')
        )
      })
    })

    describe('when the merger reports a conflict', () => {
      it('then it is a content conflict carrying the merger output', () => {
        // Arrange
        const mergeEntry = mergerReturning(true)

        // Act
        const sut = statusesOf('', 'B:x', 'B:y', mergeEntry)

        // Assert
        expect(sut).toEqual([
          { kind: 'contentConflict', output: MERGED_OUTPUT },
        ])
      })
    })
  })

  describe.each([
    ['local', 'X', ''],
    ['other', '', 'X'],
  ])('given an entry only %s inserted', (_side, local, other) => {
    it('then it is clean with that value', () => {
      // Arrange
      const mergeEntry = mergerReturning(false)

      // Act
      const sut = statusesOf('', local, other, mergeEntry)

      // Assert
      expect(sut).toEqual([{ kind: 'clean', output: wrapped('X') }])
    })
  })
})

describe('given the readings of one merge settled in turn', () => {
  it.each([
    [
      'token sides with keyed and keyless repeated keys',
      caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS).map(fromTokens),
    ],
    [
      'token sides joined by a cut',
      cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS).map(fromTokens),
    ],
    ['token sides stitched by a cut', stitchedCaseArb.map(fromTokens)],
    [
      'token sides with spans of identical copies',
      groupCaseArb.map(fromTokens),
    ],
    [
      'entries with one contested entry',
      contestedSidesArb(ordered).map(fromEntries),
    ],
  ])(
    'when %s are settled by one function, then every reading reads the plain statuses',
    (_name, sidesArb) => {
      fc.assert(
        fc.property(sidesArb, sides => {
          // Arrange
          const readings = everyReading(sides)
          const expected = settledInTurn(readings, plainStatuses)

          // Act
          const sut = settledInTurn(
            readings,
            entryStatusesBy(rememberingKept())
          )

          // Assert
          expect(sut).toEqual(expected)
        })
      )
    }
  )
})

const rememberedInTurn = (
  tokens: readonly [string, string, string],
  mergeEntry: EntryMerger
): readonly (readonly EntryStatus[])[] => {
  const sut = entryStatusesBy(rememberingKept())
  return readingsOf(...tokens).map(reading => sut(inputOf(reading, mergeEntry)))
}

// B is kept by all in both readings, with the same two copies: only the
// reading of which A local dropped differs
const SAME_COPIES = ['A A B', 'A B*', 'A A B+'] as const
const SETTLED_AT = 2

// The middle ancestor A is kept by all in the first and the last reading,
// with local's A+ in one and local's A* in the other
const OTHER_COPIES = ['A A A', 'A* A+', 'A A A'] as const

describe('given statuses settled by one memory', () => {
  describe('when two readings pair an ancestor entry with the same copies', () => {
    it('then the second status is the first and the merger ran once', () => {
      // Arrange
      const mergeEntry = mergerReturning(false)

      // Act
      const [first, second] = rememberedInTurn(SAME_COPIES, mergeEntry)

      // Assert
      const sut = second![SETTLED_AT]
      expect(sut).toBe(first![SETTLED_AT])
      expect(sut).toEqual({ kind: 'clean', output: MERGED_OUTPUT })
      expect(mergeEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('when two readings pair an ancestor entry with other copies', () => {
    it('then each reading settles the status of its own copies', () => {
      // Arrange
      const mergeEntry = mergerReturning(false)

      // Act
      const sut = rememberedInTurn(OTHER_COPIES, mergeEntry)

      // Assert
      expect(sut).toEqual([
        [
          { kind: 'clean', output: wrapped('A*') },
          { kind: 'clean', output: wrapped('A+') },
          { kind: 'gone' },
        ],
        [
          { kind: 'clean', output: wrapped('A*') },
          { kind: 'gone' },
          { kind: 'clean', output: wrapped('A+') },
        ],
        [
          { kind: 'gone' },
          { kind: 'clean', output: wrapped('A*') },
          { kind: 'clean', output: wrapped('A+') },
        ],
      ])
    })
  })

  describe('when both sides edited the entry apart', () => {
    it('then every reading holds its content conflict', () => {
      // Arrange
      const mergeEntry = mergerReturning(true)

      // Act
      const sut = rememberedInTurn(SAME_COPIES, mergeEntry)

      // Assert
      expect(sut.map(statuses => statuses[SETTLED_AT])).toEqual([
        { kind: 'contentConflict', output: MERGED_OUTPUT },
        { kind: 'contentConflict', output: MERGED_OUTPUT },
      ])
    })
  })
})
