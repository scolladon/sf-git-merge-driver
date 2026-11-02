import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  everyEntry,
  isKeptByAll,
  lisLength,
  notInEveryLis,
  possiblyMoved,
} from '../../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  ABSENT_POSITION as ABSENT,
  type OrderedEntry,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'

describe('lisLength', () => {
  describe('given a sequence with a gap', () => {
    it('then it is the longest increasing run', () => {
      // Arrange
      const sut = lisLength

      // Act
      const result = sut([2, 0, 1, 3])

      // Assert
      expect(result).toBe(3)
    })
  })

  describe('given an empty sequence', () => {
    it('then it is zero', () => {
      // Arrange
      const sut = lisLength

      // Act
      const result = sut([])

      // Assert
      expect(result).toBe(0)
    })
  })
})

describe('notInEveryLis', () => {
  describe.each([
    ['a swapped head', [1, 0, 2, 3], [true, true, false, false]],
    [
      'a head moved to the third slot',
      [2, 0, 1, 3],
      [true, false, false, false],
    ],
    ['an already ordered sequence', [0, 1, 2], [false, false, false]],
    ['a reversed sequence', [2, 1, 0], [true, true, true]],
    ['a single element', [0], [false]],
    ['an empty sequence', [], []],
  ])('given %s', (_name, sequence, expected) => {
    it('then it flags what some longest run leaves out', () => {
      // Arrange
      const sut = notInEveryLis

      // Act
      const result = sut(sequence)

      // Assert
      expect(result).toEqual(expected)
    })
  })
})

const isIncreasing = (values: readonly number[]): boolean =>
  values.every(
    (value, index) => index === 0 || (values[index - 1] as number) < value
  )

const longestIncreasingSubsets = (
  sequence: readonly number[]
): readonly (readonly number[])[] => {
  const subsets = Array.from({ length: 2 ** sequence.length }, (_, mask) =>
    sequence.map((_, index) => index).filter(index => (mask >> index) & 1)
  ).filter(indices =>
    isIncreasing(indices.map(index => sequence[index] as number))
  )
  const longest = Math.max(...subsets.map(subset => subset.length))
  return subsets.filter(subset => subset.length === longest)
}

const bruteForceNotInEveryLis = (sequence: readonly number[]): boolean[] => {
  const longest = longestIncreasingSubsets(sequence)
  return sequence.map((_, index) => !longest.every(s => s.includes(index)))
}

describe('notInEveryLis against every maximum increasing subsequence', () => {
  describe('given any order of up to seven distinct values', () => {
    it('then it flags what the intersection of all maxima leaves out', () => {
      fc.assert(
        fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6]), sequence => {
          // Arrange
          const sut = notInEveryLis

          // Act
          const result = sut(sequence)

          // Assert
          expect(result).toEqual(bruteForceNotInEveryLis(sequence))
        })
      )
    })
  })
})

const VALUE = { name: 'x' }

const entryAt = (
  id: number,
  ancestorPos: number,
  localPos: number,
  otherPos: number
): OrderedEntry => ({
  id,
  key: String(id),
  ...(ancestorPos === ABSENT ? {} : { ancestor: VALUE }),
  ...(localPos === ABSENT ? {} : { local: VALUE }),
  ...(otherPos === ABSENT ? {} : { other: VALUE }),
  ancestorPos,
  localPos,
  otherPos,
})

// ids 0..3 are A..D
const reading = (
  local: readonly number[],
  other: readonly number[]
): readonly OrderedEntry[] =>
  [0, 1, 2, 3].map(id => entryAt(id, id, local.indexOf(id), other.indexOf(id)))

const sorted = (ids: ReadonlySet<number>): number[] => [...ids].sort()

describe('possiblyMoved', () => {
  describe.each([
    ['a swapped head on local', 'local', [1, 0, 2, 3], [0, 1, 2, 3], [0, 1]],
    [
      'the head moved behind two others',
      'local',
      [1, 2, 0, 3],
      [0, 1, 2, 3],
      [0],
    ],
    ['a swapped tail on local', 'local', [0, 1, 3, 2], [0, 1, 2, 3], [2, 3]],
    ['a swapped tail on other', 'other', [0, 1, 2, 3], [0, 1, 3, 2], [2, 3]],
    ['an untouched side', 'other', [1, 0, 2, 3], [0, 1, 2, 3], []],
  ] as const)('given %s', (_name, side, local, other, expected) => {
    it('then the entries not in every longest run are moved', () => {
      // Arrange
      const sut = possiblyMoved
      const entries = reading(local, other)

      // Act
      const result = sut(entries, side, everyEntry)

      // Assert
      expect(sorted(result)).toEqual(expected)
    })
  })

  describe('given an entry the other side deleted', () => {
    const entries = [
      entryAt(0, 0, 1, 1),
      entryAt(1, 1, 0, ABSENT),
      entryAt(2, 2, 2, 0),
    ]

    it('then the keeper own kept set counts it', () => {
      // Arrange
      const sut = possiblyMoved

      // Act
      const result = sut(entries, 'local', everyEntry)

      // Assert
      expect(sorted(result)).toEqual([0, 1])
    })

    it('then the entries kept by all ignore it', () => {
      // Arrange
      const sut = possiblyMoved

      // Act
      const result = sut(entries, 'local', isKeptByAll)

      // Assert
      expect(sorted(result)).toEqual([])
    })
  })

  describe('given entries listed against the ancestor order', () => {
    it('then the ancestor order decides what moved', () => {
      // Arrange
      const sut = possiblyMoved
      const entries = reading([1, 0, 2, 3], [0, 1, 2, 3]).slice().reverse()

      // Act
      const result = sut(entries, 'local', everyEntry)

      // Assert
      expect(sorted(result)).toEqual([0, 1])
    })
  })

  describe('given an entry added on the side out of the ancestor sequence', () => {
    it('then it does not count among the moved', () => {
      // Arrange
      const sut = possiblyMoved
      const entries = [
        entryAt(0, 0, 1, 1),
        entryAt(1, 1, 2, 2),
        entryAt(2, ABSENT, 5, ABSENT),
      ]

      // Act
      const result = sut(entries, 'local', everyEntry)

      // Assert
      expect(sorted(result)).toEqual([])
    })
  })

  describe('given an entry with no ancestor or absent from the side', () => {
    it('then it is never moved', () => {
      // Arrange
      const sut = possiblyMoved
      const entries = [entryAt(0, ABSENT, 1, 0), entryAt(1, 0, ABSENT, 1)]

      // Act
      const result = sut(entries, 'local', everyEntry)

      // Assert
      expect(sorted(result)).toEqual([])
    })
  })
})

describe('isKeptByAll', () => {
  describe.each([
    ['all three sides', entryAt(0, 0, 0, 0), true],
    ['no ancestor', entryAt(0, ABSENT, 0, 0), false],
    ['no local', entryAt(0, 0, ABSENT, 0), false],
    ['no other', entryAt(0, 0, 0, ABSENT), false],
  ])('given an entry on %s', (_name, entry, expected) => {
    it('then it is reported accordingly', () => {
      // Arrange
      const sut = isKeptByAll

      // Act
      const result = sut(entry)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

describe('everyEntry', () => {
  describe('given any entry', () => {
    it('then it is accepted', () => {
      // Arrange
      const sut = everyEntry

      // Act
      const result = sut(entryAt(0, ABSENT, ABSENT, ABSENT))

      // Assert
      expect(result).toBe(true)
    })
  })
})
