import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  agreedOrderSidesArb,
  assertLaw,
  dupSidesArb,
  entriesOf,
  entryTokens,
  type KindSpec,
  mergeFile,
  namedTypes,
  orderedTypes,
  permArb,
  type Side,
  sidesArb,
  splitFieldsArb,
  unorderedTypes,
} from './arbitraries.js'

type Sides = readonly [Side, Side, Side]

// The permutation ranks keys, so entries of one key keep their own order:
// only the order between different entries changes
const rankedBy =
  (spec: KindSpec, perm: readonly string[]) =>
  (side: Side): Side =>
    [...side].sort(
      (left, right) =>
        perm.indexOf(spec.keyOf(left)) - perm.indexOf(spec.keyOf(right))
    )

const entryOrderIsIrrelevant = (spec: KindSpec) =>
  fc.asyncProperty(
    fc.oneof(sidesArb(spec), dupSidesArb(spec)),
    permArb,
    async (sides, perm) => {
      // Arrange
      const permuted = sides.map(rankedBy(spec, perm)) as unknown as Sides
      const base = await mergeFile(spec, sides)

      // Act
      const sut = await mergeFile(spec, permuted)

      // Assert
      expect(sut.hasConflict).toBe(base.hasConflict)
      if (base.hasConflict) return
      expect(entryTokens(spec, sut.output)).toEqual(
        entryTokens(spec, base.output)
      )
    }
  )

const keysIn = (spec: KindSpec, side: Side): string[] => side.map(spec.keyOf)

const agreedPairs = (local: string[], other: string[]) =>
  local.flatMap((first, i) =>
    local
      .slice(i + 1)
      .filter(
        second =>
          other.includes(first) &&
          other.includes(second) &&
          other.indexOf(first) < other.indexOf(second)
      )
      .map(second => [first, second] as const)
  )

const agreedOrderIsKept = (spec: KindSpec) =>
  fc.asyncProperty(agreedOrderSidesArb(spec), async sides => {
    // Arrange
    const [, local, other] = sides
    const sut = await mergeFile(spec, sides)
    fc.pre(!sut.hasConflict)
    const merged = keysIn(spec, entriesOf(spec, sut.output))

    // Act
    const broken = agreedPairs(keysIn(spec, local), keysIn(spec, other)).filter(
      ([first, second]) =>
        merged.indexOf(first) < 0 ||
        merged.indexOf(first) > merged.indexOf(second)
    )

    // Assert
    expect(broken).toEqual([])
  })

const editedEntryIsMatchedByKey = (spec: KindSpec) =>
  fc.asyncProperty(splitFieldsArb(spec), async ({ a, l, o, both }) => {
    // Arrange
    const merges: readonly [Sides, Side][] = [
      [[a, l, o], both],
      [[a, l, a], l],
      [[a, a, o], o],
    ]

    for (const [sides, expected] of merges) {
      // Act
      const sut = await mergeFile(spec, sides)

      // Assert
      expect(sut.hasConflict).toBe(false)
      expect(entryTokens(spec, sut.output)).toEqual(
        expected.map(entry => JSON.stringify(entry)).sort()
      )
    }
  })

describe('JsonMerger laws: type-driven merge', () => {
  describe.each(namedTypes(unorderedTypes))(
    'given %s sides of an unordered keyed type',
    (_name, spec) => {
      it('when the entries of the three versions are permuted consistently then the merged entries and the conflict status are unchanged', async () => {
        await assertLaw(entryOrderIsIrrelevant(spec))
      })
    }
  )

  describe.each(namedTypes(orderedTypes))(
    'given %s sides of an ordered type',
    (_name, spec) => {
      it('when the merge is clean then two entries both live sides order alike keep that order', async () => {
        await assertLaw(agreedOrderIsKept(spec))
      })
    }
  )

  describe.each(namedTypes([...unorderedTypes, ...orderedTypes]))(
    'given %s sides editing non-key fields of one entry',
    (_name, spec) => {
      it('when merging then the entry is matched by key, keeps every edit and appears once', async () => {
        await assertLaw(editedEntryIsMatchedByKey(spec))
      })
    }
  )
})
