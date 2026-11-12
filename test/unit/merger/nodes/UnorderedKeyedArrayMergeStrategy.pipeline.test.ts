import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  extractKeys,
  type KeyedSides,
  toSideKeys,
} from '../../../../src/merger/nodes/KeyedArrayIndex.js'
import {
  groupByKey,
  type KeyCopies,
  type KeyGroup,
} from '../../../../src/merger/nodes/keyedReadings.js'
import { UnorderedKeyedArrayMergeStrategy } from '../../../../src/merger/nodes/UnorderedKeyedArrayMergeStrategy.js'
import { MetadataService } from '../../../../src/service/MetadataService.js'
import type { JsonArray } from '../../../../src/types/jsonTypes.js'
import {
  UnorderedKeyedArrayMergeStrategy as ListGroupedStrategy,
  groupByKey as listGroupByKey,
} from '../../../utils/oracles/listGroupedUnorderedMerge.js'
import { defaultConfig } from '../../../utils/testConfig.js'
import { dupSidesArb, keyed, sidesArb } from '../laws/arbitraries.js'

type Sides = readonly [JsonArray, JsonArray, JsonArray]

const keyOf = MetadataService.getKeyFieldExtractor(keyed.attribute)

const sideKeys = (side: JsonArray) =>
  keyOf === undefined ? undefined : toSideKeys(extractKeys(side, keyOf))

// Read as KeyedArrayMergeNode reads them: a side holding a keyless entry
// leaves the keyed path, so it never reaches the strategy.
const keysOf = ([ancestor, local, other]: Sides): KeyedSides | undefined => {
  const [a, l, o] = [sideKeys(ancestor), sideKeys(local), sideKeys(other)]
  return a && l && o ? { ancestor: a, local: l, other: o } : undefined
}

const keyedCases = fc
  .oneof(sidesArb(keyed), dupSidesArb(keyed))
  .map(sides => sides as Sides)
  .map(sides => ({ sides, keys: keysOf(sides) }))
  .filter(
    (keyedCase): keyedCase is { sides: Sides; keys: KeyedSides } =>
      keyedCase.keys !== undefined
  )

const SIDES = ['ancestor', 'local', 'other'] as const

const repeatsKey = (lists: KeyCopies): boolean =>
  SIDES.some(side => lists[side].length > 1)

const listOfOne = <T>(entry: T | undefined): readonly T[] =>
  entry === undefined ? [] : [entry]

// By reference: the group holds the very entries the oracle lists
const expectSameEntries = (group: KeyGroup, lists: KeyCopies): void => {
  for (const side of SIDES) {
    const held =
      group.copies === undefined ? listOfOne(group[side]) : group.copies[side]
    expect(held).toHaveLength(lists[side].length)
    held.forEach((entry, index) => {
      expect(entry).toBe(lists[side][index])
    })
  }
}

describe('UnorderedKeyedArrayMergeStrategy', () => {
  describe('given three sides of an unordered keyed array', () => {
    describe('when merged', () => {
      it('then the output and the conflict flag are those of the list-grouped merge', () => {
        fc.assert(
          fc.property(keyedCases, ({ sides, keys }) => {
            // Arrange
            const expected = new ListGroupedStrategy(
              ...sides,
              keyed.attribute,
              keys
            ).merge(defaultConfig)
            const sut = new UnorderedKeyedArrayMergeStrategy(
              ...sides,
              keyed.attribute,
              keys
            )

            // Act
            const result = sut.merge(defaultConfig)

            // Assert
            expect(result.output).toEqual(expected.output)
            expect(result.hasConflict).toBe(expected.hasConflict)
          })
        )
      })
    })
  })

  describe('given the same sides', () => {
    describe('when grouped by key', () => {
      it('then a group holds lists iff a side repeats its key, and its entries are the list-grouped ones', () => {
        fc.assert(
          fc.property(keyedCases, ({ sides, keys }) => {
            // Arrange
            const expected = listGroupByKey(...sides, keys)
            const sut = groupByKey

            // Act
            const result = sut(...sides, keys)

            // Assert
            expect(new Set(result.keys())).toStrictEqual(
              new Set(expected.keys())
            )
            for (const [key, lists] of expected) {
              const group = result.get(key) as KeyGroup
              expect(group.copies !== undefined).toBe(repeatsKey(lists))
              expectSameEntries(group, lists)
            }
          })
        )
      })
    })
  })
})
