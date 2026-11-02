import { describe, expect, it, vi } from 'vitest'
import {
  type EntryMerger,
  type EntryStatus,
  entryStatuses,
} from '../../../../../src/merger/nodes/ordered/content.js'
import {
  everyEntry,
  possiblyMoved,
} from '../../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  LIVE_SIDES,
  type LiveSide,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import type { MergeResult } from '../../../../../src/types/mergeResult.js'
import {
  ORDERED_ATTRIBUTE,
  readingsOf,
  toEntry,
} from '../../../../utils/orderedTokens.js'

const MERGED_OUTPUT = [{ [ORDERED_ATTRIBUTE]: { merged: 'fields' } }]

const mergerReturning = (hasConflict: boolean) =>
  vi.fn<EntryMerger>(
    (): MergeResult => ({ output: MERGED_OUTPUT, hasConflict })
  )

const statusesOf = (
  ancestor: string,
  local: string,
  other: string,
  mergeEntry: EntryMerger
): readonly EntryStatus[] => {
  const [reading] = readingsOf(ancestor, local, other)
  const movedOwn = Object.fromEntries(
    LIVE_SIDES.map(side => [side, possiblyMoved(reading!, side, everyEntry)])
  ) as Record<LiveSide, ReadonlySet<number>>
  return entryStatuses({
    reading: reading!,
    movedOwn,
    attribute: ORDERED_ATTRIBUTE,
    mergeEntry,
  })
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
