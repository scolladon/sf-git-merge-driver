import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SideKeys } from '../../../../../src/merger/nodes/KeyedArrayIndex.js'
import { identityTies } from '../../../../../src/merger/nodes/ordered/identity.js'
import type { OrderedSides } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { tiePartsOf } from '../../../../../src/merger/nodes/ordered/tieParts.js'
import type { JsonObject } from '../../../../../src/types/jsonTypes.js'
import { jsonIdentical } from '../../../../../src/utils/jsonEqual.js'
import { signatureOf } from '../../../../../src/utils/jsonSignature.js'
import {
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
} from '../../../../utils/orderedCases.js'
import { cutCaseArb } from '../../../../utils/orderedCuts.js'
import {
  ORDERED_ATTRIBUTE,
  orderedSides,
} from '../../../../utils/orderedTokens.js'

const SIDE_NAMES = ['ancestor', 'local', 'other'] as const

const TWO_LEAST_TUPLES = 2

const placesOf = (keys: SideKeys, key: string): readonly number[] =>
  keys.flatMap((candidate, at) => (candidate === key ? [at] : []))

const isHeldOnceAndAlike = (sides: OrderedSides, key: string): boolean => {
  const places = SIDE_NAMES.map(side => placesOf(sides.keys[side], key))
  if (!places.every(held => held.length === 1)) return false
  const [ancestor, local, other] = SIDE_NAMES.map(
    (side, at) => sides[side][places[at][0]]
  )
  return jsonIdentical(ancestor, local) && jsonIdentical(ancestor, other)
}

const allKeys = (sides: OrderedSides): readonly string[] => [
  ...new Set(SIDE_NAMES.flatMap(side => sides.keys[side])),
]

// The side of the cut each copy of the key stands on, over the three sides
const sidesOfCopies = (
  sides: OrderedSides,
  cut: string,
  key: string
): ReadonlySet<boolean> =>
  new Set(
    SIDE_NAMES.flatMap(side => {
      const [cutPlace] = placesOf(sides.keys[side], cut)
      return placesOf(sides.keys[side], key).map(at => at < cutPlace)
    })
  )

const isCutByDefinition = (sides: OrderedSides, key: string): boolean =>
  isHeldOnceAndAlike(sides, key) &&
  allKeys(sides)
    .filter(other => other !== key)
    .every(other => sidesOfCopies(sides, key, other).size <= 1)

const cutKeysByDefinition = (sides: OrderedSides): readonly string[] =>
  [...new Set(sides.keys.ancestor)].filter(key => isCutByDefinition(sides, key))

const partByDefinition = (
  sides: OrderedSides,
  cutKeys: readonly string[],
  key: string
): number => {
  const side = SIDE_NAMES.find(name => sides.keys[name].includes(key))
  const keys = sides.keys[side as (typeof SIDE_NAMES)[number]]
  const first = keys.indexOf(key)
  return cutKeys.filter(cut => keys.indexOf(cut) < first).length
}

const cutItemOf = (value: unknown): string =>
  signatureOf({ [ORDERED_ATTRIBUTE]: value as JsonObject })

const sidesOfCase = ([ancestor, local, other]: readonly [
  readonly string[],
  readonly string[],
  readonly string[],
]): OrderedSides =>
  orderedSides(ancestor.join(' '), local.join(' '), other.join(' '))

const tiePartsFor = (sides: OrderedSides) => {
  const ties = identityTies(
    sides.ancestor,
    sides.local,
    sides.other,
    sides.keys
  )
  return { ties, parts: tiePartsOf(sides, ties, ORDERED_ATTRIBUTE) }
}

const GENERATED_CASES = fc.oneof(
  cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
  caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS)
)

describe('given generated sides with and without cuts', () => {
  describe('when finding the tie parts', () => {
    it('then the cut items are those of the keys meeting the definition', () => {
      fc.assert(
        fc.property(GENERATED_CASES, tokens => {
          // Arrange
          const sides = sidesOfCase(tokens)
          const expected = new Set(
            cutKeysByDefinition(sides).map(key =>
              cutItemOf(sides.ancestor[sides.keys.ancestor.indexOf(key)])
            )
          )

          // Act
          const sut = tiePartsFor(sides).parts

          // Assert
          expect(new Set(sut.cutItems)).toEqual(expected)
        })
      )
    })

    it('then each tied part holds the components of one part, apart from the others', () => {
      fc.assert(
        fc.property(GENERATED_CASES, tokens => {
          // Arrange
          const sides = sidesOfCase(tokens)
          const cutKeys = cutKeysByDefinition(sides)
          const { ties, parts } = tiePartsFor(sides)
          const partsOf = (component: number): ReadonlySet<number> =>
            new Set(
              ties.components[component].members.map(stretch =>
                partByDefinition(sides, cutKeys, ties.keyOf(stretch))
              )
            )

          // Act
          const sut = parts.tied

          // Assert
          const partNumbers = sut.map(
            part => new Set(part.flatMap(component => [...partsOf(component)]))
          )
          expect(partNumbers.every(found => found.size === 1)).toBe(true)
          expect(new Set(partNumbers.flatMap(found => [...found])).size).toBe(
            sut.length
          )
        })
      )
    })

    it('then the listed components are exactly those with two least tuples or more', () => {
      fc.assert(
        fc.property(GENERATED_CASES, tokens => {
          // Arrange
          const sides = sidesOfCase(tokens)
          const { ties, parts } = tiePartsFor(sides)
          const expected = ties.components.flatMap((component, at) =>
            component.minimal.length >= TWO_LEAST_TUPLES ? [at] : []
          )

          // Act
          const sut = parts.tied.flat()

          // Assert
          expect([...sut].sort((left, right) => left - right)).toEqual(expected)
        })
      )
    })
  })
})

const CUT_C = signatureOf({
  [ORDERED_ATTRIBUTE]: { fullName: 'C', label: 'C' },
})

const partsOfTokens = (ancestor: string, local: string, other: string) =>
  tiePartsFor(orderedSides(ancestor, local, other)).parts

describe('given two repeated keys around a unique key', () => {
  describe('when finding the tie parts', () => {
    it('then each repeated key is a tied part and the unique key is the cut', () => {
      // Arrange
      const sides = ['A A C B B', 'A C B', 'A A C B B Z'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toEqual([[0], [1]])
      expect(sut.cutItems).toEqual(new Set([CUT_C]))
    })
  })
})

describe('given the unique key edited by local', () => {
  describe('when finding the tie parts', () => {
    it('then both repeated keys share one part and no key is a cut', () => {
      // Arrange
      const sides = ['A A C B B', 'A C* B', 'A A C B B Z'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toEqual([[0, 1]])
      expect(sut.cutItems.size).toBe(0)
    })
  })
})

describe('given a repeated key copied past the unique key on local', () => {
  describe('when finding the tie parts', () => {
    it('then no key is a cut', () => {
      // Arrange
      const sides = ['A A C B B', 'A C B A', 'A A C B B Z'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toEqual([[0]])
      expect(sut.cutItems.size).toBe(0)
    })
  })
})

describe('given no unique key between two repeated keys', () => {
  describe('when finding the tie parts', () => {
    it('then the repeated keys are two components of one part and no key is a cut', () => {
      // Arrange
      const sides = ['A A B B', 'A B', 'A A B B Z'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toEqual([[0, 1]])
      expect(sut.cutItems.size).toBe(0)
    })
  })
})

describe('given unique keys only', () => {
  describe('when finding the tie parts', () => {
    it('then no part is tied and every unchanged key is a cut', () => {
      // Arrange
      const sides = ['A B', 'A B C', 'A B'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toEqual([])
      expect(sut.cutItems).toEqual(
        new Set(
          ['A', 'B'].map(key =>
            signatureOf({
              [ORDERED_ATTRIBUTE]: { fullName: key, label: key },
            })
          )
        )
      )
    })
  })
})

describe('given the unique key held twice on local', () => {
  describe('when finding the tie parts', () => {
    it('then no key is a cut and one part is tied', () => {
      // Arrange
      const sides = ['A A C B B', 'A C B C', 'A A C B B Z'] as const

      // Act
      const sut = partsOfTokens(...sides)

      // Assert
      expect(sut.tied).toHaveLength(1)
      expect(sut.cutItems.size).toBe(0)
    })
  })
})

describe('given the unique key listing its fields in another order on other', () => {
  describe('when finding the tie parts', () => {
    it('then the key is not a cut', () => {
      // Arrange
      const sides = orderedSides('A A C B B', 'A C B', 'A A C B B Z')
      const reordered: OrderedSides = {
        ...sides,
        other: sides.other.map((entry, at) =>
          at === 2 ? { label: 'C', fullName: 'C' } : entry
        ),
      }
      const ties = identityTies(
        reordered.ancestor,
        reordered.local,
        reordered.other,
        reordered.keys
      )

      // Act
      const sut = tiePartsOf(reordered, ties, ORDERED_ATTRIBUTE)

      // Assert
      expect(sut.cutItems.size).toBe(0)
    })
  })
})
