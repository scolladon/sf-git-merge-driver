import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { JsonMerger } from '../../../../src/merger/JsonMerger.js'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'
import {
  assertLaw,
  attributeOf,
  changedSideArb,
  contestedOrderArb,
  decisionArb,
  editOf,
  entriesOf,
  isProperty,
  KEYS,
  type KindSpec,
  keyed,
  type MergeOutcome,
  merge,
  ordered,
  property,
  render,
  retrieveShaped,
  rootProperty,
  type Side,
  same,
  sideArb,
  sidesArb,
  text,
} from './arbitraries.js'
import { canonicalOrder, referenceOrder } from './childTagReference.js'

const assertEquivalent = async (
  left: MergeOutcome,
  right: MergeOutcome
): Promise<void> => {
  expect(left.hasConflict).toBe(false)
  expect(right.hasConflict).toBe(false)
  expect(await render(left.output)).toBe(await render(right.output))
}

const idempotence = (spec: KindSpec) =>
  fc.asyncProperty(sideArb(spec), async x => {
    // Arrange
    const side = x

    // Act
    const sut = merge(spec, side, side, side)

    // Assert
    expect(sut.hasConflict).toBe(false)
    expect(entriesOf(spec, await render(sut.output))).toEqual(side)
  })

const oneSidedChange = (spec: KindSpec) =>
  fc.asyncProperty(
    sideArb(spec).chain(a => fc.tuple(fc.constant(a), editOf(spec, a))),
    async ([ancestor, edit]) => {
      // Arrange
      const a = retrieveShaped(spec, ancestor)
      const o = retrieveShaped(spec, edit)

      // Act
      const sut = merge(spec, a, a, o)
      const mirrored = merge(spec, a, o, a)

      // Assert
      await assertEquivalent(sut, merge(spec, o, o, o))
      await assertEquivalent(mirrored, merge(spec, o, o, o))
    }
  )

const sameChange = (spec: KindSpec) =>
  fc.asyncProperty(
    sideArb(spec).chain(a => fc.tuple(fc.constant(a), changedSideArb(spec, a))),
    async ([ancestor, change]) => {
      // Arrange
      const a = retrieveShaped(spec, ancestor)
      const x = retrieveShaped(spec, change)

      // Act
      const sut = merge(spec, a, x, x)

      // Assert
      await assertEquivalent(sut, merge(spec, x, x, x))
    }
  )

const expectedKeys = (
  spec: KindSpec,
  [a, l, o]: readonly [Side, Side, Side]
): string[] => {
  const [inA, inL, inO] = [a, l, o].map(side => side.map(spec.keyOf))
  return KEYS.filter(
    k =>
      (inL.includes(k) && inO.includes(k)) ||
      (!inA.includes(k) && (inL.includes(k) || inO.includes(k)))
  )
}

const editSidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  sideArb(spec).chain(ancestor =>
    fc.tuple(
      fc.constant(ancestor),
      editOf(spec, ancestor),
      editOf(spec, ancestor)
    )
  )

const noLossNoDuplication = (
  spec: KindSpec,
  sidesFor: (spec: KindSpec) => fc.Arbitrary<readonly [Side, Side, Side]>
) =>
  fc.asyncProperty(sidesFor(spec), async sides => {
    // Arrange
    const [a, l, o] = sides
    const sut = merge(spec, a, l, o)
    fc.pre(!sut.hasConflict)

    // Act
    const keys = entriesOf(spec, await render(sut.output)).map(spec.keyOf)

    // Assert
    expect([...keys].sort()).toEqual(expectedKeys(spec, sides))
  })

const splitArb = <T>(values: readonly T[]): fc.Arbitrary<[T[], T[]]> =>
  fc
    .array(fc.boolean(), {
      minLength: values.length,
      maxLength: values.length,
    })
    .map(bits => [
      values.filter((_, i) => bits[i]),
      values.filter((_, i) => !bits[i]),
    ])

const decideAll = (spec: KindSpec, own: Side): fc.Arbitrary<Side> =>
  fc.tuple(...own.map(entry => decisionArb(spec, entry))).map(d => d.flat())

const insertOwn = (spec: KindSpec, pool: string[]): fc.Arbitrary<Side> =>
  fc.subarray(pool).chain(keys => fc.tuple(...keys.map(spec.entry)))

interface Touch {
  readonly own: Side
  readonly decided: Side
}

const applyTouch = (spec: KindSpec, entry: JsonValue, touch: Touch): Side => {
  if (!touch.own.some(mine => same(mine, entry))) return [entry]
  return touch.decided.filter(d => spec.keyOf(d) === spec.keyOf(entry))
}

interface DisjointEdits {
  readonly a: Side
  readonly l: Side
  readonly o: Side
  readonly both: Side
}

const combineEdits = (
  spec: KindSpec,
  ancestor: Side,
  [local, other]: readonly [Touch, Touch],
  [insertedL, insertedO]: readonly [Side, Side]
): DisjointEdits => {
  const onL = (e: JsonValue) => applyTouch(spec, e, local)
  const onO = (e: JsonValue) => applyTouch(spec, e, other)
  const owned = (e: JsonValue) => local.own.some(mine => same(mine, e))
  const kept = ancestor.flatMap(e => (owned(e) ? onL(e) : onO(e)))
  return {
    a: ancestor,
    l: [...ancestor.flatMap(onL), ...insertedL],
    o: [...ancestor.flatMap(onO), ...insertedO],
    both: [...kept, ...insertedL, ...insertedO],
  }
}

// Only one side inserts into a positional kind: two insertions in the same
// gap are an order question, not a compatible change
const insertionsFor = (spec: KindSpec, pool: string[]): fc.Arbitrary<Side> =>
  spec.emission === 'positional' ? fc.constant([]) : insertOwn(spec, pool)

interface KeySplit {
  readonly ancestor: Side
  readonly ownL: Side
  readonly ownO: Side
  readonly poolL: string[]
  readonly poolO: string[]
}

const splitKeys = (spec: KindSpec, ancestor: Side): fc.Arbitrary<KeySplit> => {
  const used = new Set(ancestor.map(spec.keyOf))
  const unused = KEYS.filter(key => !used.has(key))
  return fc
    .tuple(splitArb(ancestor), splitArb(unused))
    .map(([[ownL, ownO], [poolL, poolO]]) => ({
      ancestor,
      ownL,
      ownO,
      poolL,
      poolO,
    }))
}

const editsWithin = (
  spec: KindSpec,
  { ancestor, ownL, ownO, poolL, poolO }: KeySplit
): fc.Arbitrary<DisjointEdits> =>
  fc
    .tuple(
      decideAll(spec, ownL),
      decideAll(spec, ownO),
      insertOwn(spec, poolL),
      insertionsFor(spec, poolO)
    )
    .map(([decidedL, decidedO, insertedL, insertedO]) =>
      combineEdits(
        spec,
        ancestor,
        [
          { own: ownL, decided: decidedL },
          { own: ownO, decided: decidedO },
        ],
        [insertedL, insertedO]
      )
    )

const disjointEditsArb = (spec: KindSpec): fc.Arbitrary<DisjointEdits> =>
  sideArb(spec)
    .chain(ancestor => splitKeys(spec, ancestor))
    .chain(split => editsWithin(spec, split))

// Emptying the element deletes it, which touches every property: not a
// disjoint edit
const touchesDisjointKeys = (spec: KindSpec, edits: DisjointEdits): boolean =>
  !isProperty(spec) ||
  edits.a.length === 0 ||
  (edits.l.length > 0 && edits.o.length > 0)

const compatibleMerge = (spec: KindSpec) =>
  fc.asyncProperty(disjointEditsArb(spec), async edits => {
    // Arrange
    fc.pre(touchesDisjointKeys(spec, edits))
    const [a, l, o, both] = [edits.a, edits.l, edits.o, edits.both].map(side =>
      retrieveShaped(spec, side)
    )
    const expected = merge(spec, both, both, both)

    // Act
    const sut = merge(spec, a, l, o)

    // Assert
    expect(sut.hasConflict).toBe(false)
    expect(await render(sut.output)).toBe(await render(expected.output))
  })

const reorderedSidesArb = fc
  .shuffledSubarray(KEYS, { minLength: 1 })
  .chain(keys =>
    fc.tuple(
      fc.tuple(...keys.map(property.entry)),
      fc
        .shuffledSubarray([...keys], { minLength: keys.length })
        .chain(order => fc.tuple(...order.map(property.entry)))
    )
  )

// One side reordering the tags of an object the other left alone is a
// change like any other: the reorder is kept, whichever side made it
const keptReorder = (spec: KindSpec) =>
  fc.asyncProperty(reorderedSidesArb, async ([ancestor, permuted]) => {
    // Arrange
    const sut = (local: Side, other: Side) =>
      merge(spec, ancestor, local, other)
    const orderOf = async (outcome: MergeOutcome) =>
      entriesOf(spec, await render(outcome.output)).map(spec.keyOf)

    // Act
    const [onOther, onLocal] = [
      sut(ancestor, permuted),
      sut(permuted, ancestor),
    ]

    // Assert
    const expected = permuted.map(spec.keyOf)
    expect(await orderOf(onOther)).toEqual(expected)
    expect(await orderOf(onLocal)).toEqual(expected)
  })

describe('JsonMerger laws: compatible changes merge', () => {
  describe.each([
    ['keyed', keyed, sidesArb],
    ['text', text, sidesArb],
    ['ordered', ordered, sidesArb],
    ['property', property, editSidesArb],
    ['root property', rootProperty, editSidesArb],
  ])('given %s sides', (_name, spec, sidesFor) => {
    it('when merging identical sides then the merge is clean and unchanged', async () => {
      await assertLaw(idempotence(spec))
    })

    it('when one side changes then the merge renders as that change', async () => {
      await assertLaw(oneSidedChange(spec))
    })

    it('when both sides make the same change then the merge renders as that change merged with itself', async () => {
      await assertLaw(sameChange(spec))
    })

    it('when the merge is clean then no key is lost or duplicated', async () => {
      await assertLaw(noLossNoDuplication(spec, sidesFor))
    })

    it('when local and other change disjoint keys then the merge is clean and applies both', async () => {
      await assertLaw(compatibleMerge(spec))
    })
  })
})

type Owner = 'none' | 'local' | 'other'

// Adjacent swaps sharing no position, each owned by one side: the pairs
// stay disjoint, so no side contradicts the other.
const swapOwnersArb = (pairs: number) =>
  fc
    .array(fc.constantFrom<Owner>('none', 'local', 'other'), {
      minLength: pairs,
      maxLength: pairs,
    })
    .map(owners =>
      owners.map(
        (owner, at): Owner =>
          owner !== 'none' &&
          owners[at - 1] !== undefined &&
          owners[at - 1] !== 'none'
            ? 'none'
            : owner
      )
    )

const swapAdjacent = (
  side: Side,
  owners: Owner[],
  owner: Owner
): JsonValue[] => {
  const swapped = [...side]
  owners.forEach((who, at) => {
    if (who === owner) [swapped[at], swapped[at + 1]] = [side[at + 1], side[at]]
  })
  return swapped
}

const MIN_KEYS_FOR_TWO_DISJOINT_SWAPS = 4

const disjointSwapsArb = fc
  .shuffledSubarray(KEYS, { minLength: MIN_KEYS_FOR_TWO_DISJOINT_SWAPS })
  .chain(keys =>
    fc.tuple(
      fc.tuple(...keys.map(property.entry)),
      swapOwnersArb(keys.length - 1).filter(
        owners => owners.includes('local') && owners.includes('other')
      )
    )
  )

// Sides that reorder disjoint pairs of tags never contradict: every pair
// ends as the side that swapped it wrote it, every other pair as it was
const keptDisjointSwaps = (spec: KindSpec) =>
  fc.asyncProperty(disjointSwapsArb, async ([ancestor, owners]) => {
    // Arrange
    const [local, other] = [
      swapAdjacent(ancestor, owners, 'local'),
      swapAdjacent(ancestor, owners, 'other'),
    ]
    const expected = swapAdjacent(
      swapAdjacent(ancestor, owners, 'local'),
      owners,
      'other'
    ).map(spec.keyOf)
    const sut = (first: Side, second: Side) =>
      merge(spec, ancestor, first, second)
    const orderOf = async (outcome: MergeOutcome) =>
      entriesOf(spec, await render(outcome.output)).map(spec.keyOf)

    // Act
    const [onOther, onLocal] = [sut(local, other), sut(other, local)]

    // Assert
    expect(await orderOf(onOther)).toEqual(expected)
    expect(await orderOf(onLocal)).toEqual(expected)
  })

const MIN_KEYS_FOR_A_CYCLE = 3

const cyclicSwapsArb = fc
  .shuffledSubarray(KEYS, { minLength: MIN_KEYS_FOR_A_CYCLE })
  .chain(keys => fc.tuple(...keys.map(property.entry)))

const swapAt = (side: Side, at: number): JsonValue[] => {
  const swapped = [...side]
  ;[swapped[at], swapped[at + 1]] = [side[at + 1], side[at]]
  return swapped
}

// Local swaps the first pair, other the second: local puts the second key
// before the first, other the third before the second, and both keep the
// first before the third. No order holds both swaps, so those three tags are
// contested together; the tags after them stay outside the block.
// Compared as written: an element's body reaches the output as a list of its
// children, which is the same document as the object the sides parsed to
// The expected blocks are written out here, not built by the helper the
// merger uses: a swap of the sides in that helper must turn this law red.
const literalBlock = (
  local: JsonObject,
  ancestor: JsonObject,
  other: JsonObject
) => ({
  __conflict: true,
  local: [local],
  ancestor: [ancestor],
  other: [other],
})

const conflictedCycle = fc.asyncProperty(cyclicSwapsArb, async ancestor => {
  // Arrange
  const [local, other] = [swapAt(ancestor, 0), swapAt(ancestor, 1)]
  const cycled = (side: Side) =>
    attributeOf(property, side.slice(0, 3)) as JsonObject
  const block = literalBlock(cycled(local), cycled(ancestor), cycled(other))
  const sut = (first: Side, second: Side) =>
    merge(property, ancestor, first, second)

  // Act
  const [onOther, onLocal] = [sut(local, other), sut(other, local)]

  // Assert
  const mirroredBlock = literalBlock(
    cycled(other),
    cycled(ancestor),
    cycled(local)
  )
  const untouched = ancestor.slice(3)
  const expectedOn = (nameField: JsonValue[]) => [
    { CustomObject: [{ label: 'Obj' }, { nameField }] },
  ]
  expect(onOther.hasConflict).toBe(true)
  expect(await render(onOther.output)).toBe(
    await render(expectedOn([block, ...untouched]))
  )
  expect(onLocal.hasConflict).toBe(true)
  expect(await render(onLocal.output)).toBe(
    await render(expectedOn([mirroredBlock, ...untouched]))
  )
})

const tagsAt = async (spec: KindSpec, outcome: MergeOutcome) =>
  entriesOf(spec, await render(outcome.output)).map(spec.keyOf)

// The same cycle at the root level settles without a conflict: the three
// tags the cycle holds stand in canonical order where the block would have
// stood, and the tags after them stay where the sides wrote them.
const canonicalCycle = fc.asyncProperty(cyclicSwapsArb, async ancestor => {
  // Arrange
  const [local, other] = [swapAt(ancestor, 0), swapAt(ancestor, 1)]
  const sut = (first: Side, second: Side) =>
    merge(rootProperty, ancestor, first, second)

  // Act
  const [onOther, onLocal] = [sut(local, other), sut(other, local)]

  // Assert
  const keys = ancestor.map(rootProperty.keyOf)
  const expected = [...canonicalOrder(keys.slice(0, 3)), ...keys.slice(3)]
  expect(onOther.hasConflict).toBe(false)
  expect(onLocal.hasConflict).toBe(false)
  expect(await tagsAt(rootProperty, onOther)).toEqual(expected)
  expect(await tagsAt(rootProperty, onLocal)).toEqual(expected)
})

const isRunOf = (run: string[], tags: string[]): boolean =>
  run.some((_, at) => run.slice(at, at + tags.length).join() === tags.join())

const orderedPairs = (tags: string[]): [string, string][] =>
  tags.flatMap((first, at) =>
    tags.slice(at + 1).map((second): [string, string] => [first, second])
  )

// A pair both sides write the same way, with no block holding both
const agreedPairs = (
  local: string[],
  other: string[],
  blocks: readonly (readonly string[])[]
) =>
  orderedPairs(local).filter(
    ([first, second]) =>
      other.includes(first) &&
      other.includes(second) &&
      other.indexOf(first) < other.indexOf(second) &&
      !blocks.some(tags => tags.includes(first) && tags.includes(second))
  )

// Sides that move tags past one another and add one, so that the pairs they
// invert cycle and the tags they add disagree; the root level resolves what
// the nested level would have put in a block
const rootContestedOrder = (check: (sides: Side[]) => Promise<void>) =>
  fc.asyncProperty(contestedOrderArb(rootProperty), sides => check([...sides]))

describe('JsonMerger laws: property order', () => {
  describe.each([
    ['nested', property],
    ['root', rootProperty],
  ])(
    'given an object at the %s level and a permutation of its tags',
    (_level, spec) => {
      it('when one side reorders them then the merge keeps that order in both orientations', async () => {
        await assertLaw(keptReorder(spec))
      })

      it('when each side swaps a different pair then the merge keeps every swap in both orientations', async () => {
        await assertLaw(keptDisjointSwaps(spec))
      })
    }
  )

  describe('given a nested object', () => {
    it('when the sides swap overlapping pairs into a cycle then the element conflicts as one block in both orientations', async () => {
      await assertLaw(conflictedCycle)
    })
  })

  describe('given the root element', () => {
    it('when the sides swap overlapping pairs into a cycle then the merge is clean and the cycle stands in canonical order in both orientations', async () => {
      await assertLaw(canonicalCycle)
    })

    it('when the sides contest the order of its tags then the merge is clean, deterministic and symmetric', async () => {
      await assertLaw(
        rootContestedOrder(async ([a, l, o]) => {
          // Arrange
          const sut = merge(rootProperty, a, l, o)

          // Act
          const [again, swapped] = [
            merge(rootProperty, a, l, o),
            merge(rootProperty, a, o, l),
          ]

          // Assert
          expect(sut.hasConflict).toBe(false)
          expect(await render(again.output)).toBe(await render(sut.output))
          expect(await render(swapped.output)).toBe(await render(sut.output))
        })
      )
    })

    it('when the sides contest the order of its tags then the tags a block would hold stand in canonical order', async () => {
      await assertLaw(
        rootContestedOrder(async ([a, l, o]) => {
          // Arrange
          const keys = [a, l, o].map(side => side.map(rootProperty.keyOf))
          const { blocks } = referenceOrder(keys[0], keys[1], keys[2])

          // Act
          const sut = await tagsAt(rootProperty, merge(rootProperty, a, l, o))

          // Assert
          const misplaced = blocks.filter(
            tags => !isRunOf(sut, canonicalOrder(tags))
          )
          expect(misplaced).toEqual([])
        })
      )
    })

    it('when the sides contest the order of its tags then every pair both sides write the same way outside a block keeps that order', async () => {
      await assertLaw(
        rootContestedOrder(async ([a, l, o]) => {
          // Arrange
          const [ancestor, local, other] = [a, l, o].map(side =>
            side.map(rootProperty.keyOf)
          )
          const { blocks } = referenceOrder(ancestor, local, other)

          // Act
          const sut = await tagsAt(rootProperty, merge(rootProperty, a, l, o))

          // Assert
          const broken = agreedPairs(local, other, blocks).filter(
            ([first, second]) => sut.indexOf(first) > sut.indexOf(second)
          )
          expect(broken).toEqual([])
        })
      )
    })
  })
})
