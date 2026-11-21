import { describe, expect, it, vi } from 'vitest'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { mergeReading } from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import { mergePartwise } from '../../../../../src/merger/nodes/ordered/partwise.js'
import { layoutSides } from '../../../../utils/orderedCuts.js'
import {
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

// Every merged reading builds one orchestrator for its entries: counting the
// constructions counts the readings merged.
const constructions = vi.hoisted(() => ({ count: 0 }))

vi.mock(
  '../../../../../src/merger/MergeOrchestrator.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/MergeOrchestrator.js')
      >()
    class Counted extends original.MergeOrchestrator {
      constructor(
        ...args: ConstructorParameters<typeof original.MergeOrchestrator>
      ) {
        super(...args)
        constructions.count++
      }
    }
    return { ...original, MergeOrchestrator: Counted }
  }
)

vi.mock(
  '../../../../../src/merger/nodes/ordered/mergeReading.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/nodes/ordered/mergeReading.js')
      >()
    return { ...original, mergeReading: vi.fn(original.mergeReading) }
  }
)

vi.mock(
  '../../../../../src/merger/nodes/ordered/partwise.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/nodes/ordered/partwise.js')
      >()
    return { ...original, mergePartwise: vi.fn(original.mergePartwise) }
  }
)

// The statuses function each merged reading was handed: a shared one carries
// the memory of the merge, none means the plain statuses
const statusFunctionsOf = (sides: OrderedSides): readonly unknown[] => {
  mergeOrderedArrays(sides, ORDERED_ATTRIBUTE, defaultConfig)
  return vi.mocked(mergeReading).mock.calls.map(call => call[3])
}

const mergedReadingsOf = (
  sides: OrderedSides
): { readonly merges: number; readonly result: string } => {
  constructions.count = 0
  const result = mergeOrderedArrays(sides, ORDERED_ATTRIBUTE, defaultConfig)
  return { merges: constructions.count, result: formatResult(result) }
}

const mergedReadings = (ancestor: string, local: string, other: string) =>
  mergedReadingsOf(orderedSides(ancestor, local, other))

const UNEDITED_TIED_KEY_RESULT = '<C,C,X,K,U|C,C,X,K,K,U|C,C,X,K^,K,U>'
const EDITED_TIED_KEY_RESULT = '<C,C,X,K,U*|C,C,X,K,K,U|C,C,X,K^,K,U+>'
const SHARED_READING_CONFLICT_RESULT = 'K,K,<U*|U|U+>'
const SHARED_READING_CLEAN_RESULT = 'K,K,U*,V* (clean)'
const STREAMED_READINGS_RESULT = '<K,U|K,K,U|K^,K,U>'
const GROUPED_READINGS_RESULT = '<U,K,J|K,K,J,J|J,J,K,K>'
const STOPPED_STREAM_RESULT =
  '<R0:R0 edited,R0,R1:R1 edited,R1|R0,R0,R1,R1|R0,R1>'
const TIED_KEY_MERGES = 2

describe('mergeOrderedArrays', () => {
  describe.each([
    [
      'an interchangeable key beside a tied key that is not interchangeable',
      'C C X K K U',
      'C C X K U',
      'C C X K^ K U',
      UNEDITED_TIED_KEY_RESULT,
    ],
    [
      'the same keys with the neighbours edited apart',
      'C C X K K U',
      'C C X K U*',
      'C C X K^ K U+',
      EDITED_TIED_KEY_RESULT,
    ],
  ])('given %s', (_name, ancestor, local, other, expected) => {
    describe('when merging', () => {
      it('then no reading is merged twice', () => {
        // Act
        const sut = mergedReadings(ancestor, local, other)

        // Assert
        expect(sut.merges).toBe(TIED_KEY_MERGES)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given one reading holding an interchangeable key whose merge conflicts elsewhere', () => {
    const sides = ['K K U', 'K K U*', 'K K U+'] as const

    describe('when merging', () => {
      it('then the reading is merged once', () => {
        // Arrange
        const expected = SHARED_READING_CONFLICT_RESULT

        // Act
        const sut = mergedReadings(...sides)

        // Assert
        expect(sut.merges).toBe(1)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given one reading holding an interchangeable key that merges clean', () => {
    const sides = ['K K U V', 'K K U* V', 'K K U V*'] as const

    describe('when merging', () => {
      it('then the reading is merged once', () => {
        // Arrange
        const expected = SHARED_READING_CLEAN_RESULT

        // Act
        const sut = mergedReadings(...sides)

        // Assert
        expect(sut.merges).toBe(1)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given tied readings with no interchangeable key and no cut', () => {
    const sides = ['K K U', 'K U', 'K^ K U'] as const

    describe('when merging', () => {
      it('then every reading goes down the stream', () => {
        // Arrange
        const expected = STREAMED_READINGS_RESULT

        // Act
        const sut = mergedReadings(...sides)

        // Assert
        expect(sut.merges).toBeGreaterThan(1)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given tied readings that group into fewer merges than they number', () => {
    const sides = ['K K J J', 'U K J', 'J J K K'] as const

    describe('when merging', () => {
      it('then one reading per group is merged', () => {
        // Arrange
        const expected = GROUPED_READINGS_RESULT

        // Act
        const sut = mergedReadings(...sides)

        // Assert
        expect(sut.merges).toBe(3)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given tied readings of which the first two already differ and conflict', () => {
    describe('when merging', () => {
      it('then the stream stops at the second reading', () => {
        // Arrange
        const sides = layoutSides('nocut-identical', 2, 2)
        const expected = STOPPED_STREAM_RESULT

        // Act
        const sut = mergedReadingsOf(sides)

        // Assert
        expect(sut.merges).toBe(2)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given the statuses each merged reading settles', () => {
    describe('when one reading is merged', () => {
      it('then it settles them without a memory', () => {
        // Act
        const sut = statusFunctionsOf(orderedSides('K K U', 'K K U*', 'K K U+'))

        // Assert
        expect(sut).toEqual([undefined])
      })
    })

    describe('when tied readings go down the stream', () => {
      it('then they share one memory', () => {
        // Act
        const sut = statusFunctionsOf(orderedSides('K K U', 'K U', 'K^ K U'))

        // Assert
        expect(sut.length).toBeGreaterThan(1)
        expect(sut[0]).toBeInstanceOf(Function)
        expect(new Set(sut).size).toBe(1)
      })
    })

    describe('when a representative conflicts and the stream takes over', () => {
      it('then the representative settles them alone and the stream shares one memory', () => {
        // Act
        const [representative, ...streamed] = statusFunctionsOf(
          orderedSides('K K J J', 'U K J', 'J J K K')
        )

        // Assert
        expect(representative).toBeUndefined()
        expect(streamed).toHaveLength(2)
        expect(streamed[0]).toBeInstanceOf(Function)
        expect(streamed[1]).toBe(streamed[0])
      })
    })

    describe('when the tied parts are merged part by part', () => {
      it('then their readings share one memory', () => {
        // Act
        const sut = statusFunctionsOf(layoutSides('editedcut', 3, 3))

        // Assert
        expect(mergePartwise).toHaveBeenCalledOnce()
        expect(sut.length).toBeGreaterThan(1)
        expect(sut[0]).toBeInstanceOf(Function)
        expect(new Set(sut).size).toBe(1)
      })
    })
  })
})
