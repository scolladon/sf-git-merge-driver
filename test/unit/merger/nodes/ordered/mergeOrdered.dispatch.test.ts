import { describe, expect, it, vi } from 'vitest'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { mergeOrderedArrays as tieScanMerge } from '../../../../utils/oracles/tieScanMerge.js'
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

const mergedReadings = (
  ancestor: string,
  local: string,
  other: string
): { readonly merges: number; readonly result: string } => {
  const sides = orderedSides(ancestor, local, other)
  constructions.count = 0
  const result = mergeOrderedArrays(sides, ORDERED_ATTRIBUTE, defaultConfig)
  return { merges: constructions.count, result: formatResult(result) }
}

const reference = (ancestor: string, local: string, other: string): string =>
  formatResult(
    tieScanMerge(
      orderedSides(ancestor, local, other),
      ORDERED_ATTRIBUTE,
      defaultConfig
    )
  )

// The readings the tie-scan merge builds for the same sides
const referenceMerges = (
  ancestor: string,
  local: string,
  other: string
): number => {
  const sides = orderedSides(ancestor, local, other)
  constructions.count = 0
  tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)
  return constructions.count
}

describe('mergeOrderedArrays', () => {
  describe.each([
    [
      'an interchangeable key beside a tied key that is not interchangeable',
      'C C X K K U',
      'C C X K U',
      'C C X K^ K U',
    ],
    [
      'the same keys with the neighbours edited apart',
      'C C X K K U',
      'C C X K U*',
      'C C X K^ K U+',
    ],
  ])('given %s', (_name, ancestor, local, other) => {
    describe('when merging', () => {
      it('then no reading is merged twice', () => {
        // Arrange
        const expected = reference(ancestor, local, other)
        const merges = referenceMerges(ancestor, local, other)

        // Act
        const sut = mergedReadings(ancestor, local, other)

        // Assert
        expect(sut.merges).toBe(merges)
        expect(sut.result).toBe(expected)
      })
    })
  })

  describe('given one reading holding an interchangeable key whose merge conflicts elsewhere', () => {
    const sides = ['K K U', 'K K U*', 'K K U+'] as const

    describe('when merging', () => {
      it('then the reading is merged once', () => {
        // Arrange
        const expected = reference(...sides)

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
        const expected = reference(...sides)

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
        const expected = reference(...sides)

        // Act
        const sut = mergedReadings(...sides)

        // Assert
        expect(sut.merges).toBeGreaterThan(1)
        expect(sut.result).toBe(expected)
      })
    })
  })
})
