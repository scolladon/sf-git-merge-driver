import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { JsonMerger } from '../../../../src/merger/JsonMerger.js'
import {
  type ConflictBlock,
  isConflictBlock,
} from '../../../../src/types/conflictBlock.js'
import type { JsonArray, JsonValue } from '../../../../src/types/jsonTypes.js'
import { jsonIdentical } from '../../../../src/utils/jsonEqual.js'
import {
  assertLaw,
  CONFLICT,
  collectBlocks,
  contestedEntryOrderArb,
  contestedSidesArb,
  editOf,
  entriesFromValue,
  entriesOf,
  entryOutcome,
  isPlainObject,
  isProperty,
  isRootLevel,
  isText,
  KEYS,
  type KindSpec,
  keyed,
  merge,
  moveToEnd,
  ordered,
  property,
  render,
  reorderedEntryArb,
  replacementArb,
  retrieveShaped,
  rootItems,
  rootProperty,
  type Side,
  same,
  sideArb,
  sideOf,
  sidesArb,
  text,
  unwrap,
  withoutSibling,
  xmlOf,
} from './arbitraries.js'
import { referenceOrder } from './childTagReference.js'

const swapValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return swapAll(value)
  if (typeof value !== 'object' || value === null) return value
  if (isConflictBlock(value)) {
    return {
      ...value,
      local: swapAll(value.other),
      other: swapAll(value.local),
      ancestor: swapAll(value.ancestor),
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, swapValue(v)])
  )
}

const swapAll = (values: JsonArray): JsonArray => values.map(swapValue)

const symmetry = (spec: KindSpec) =>
  fc.asyncProperty(sidesArb(spec), async ([a, l, o]) => {
    // Arrange
    const swapped = merge(spec, a, o, l)

    // Act
    const sut = merge(spec, a, l, o)

    // Assert
    expect(sut.hasConflict).toBe(swapped.hasConflict)
    expect(await render(sut.output)).toBe(await render(swapAll(swapped.output)))
  })

// ---- minimality of unordered blocks

const attributeKeys = (spec: KindSpec, value: JsonValue): string[] =>
  entriesFromValue(spec, value).map(spec.keyOf)

// A tag holds text, an empty element or an element of its own
const isTagValue = (value: JsonValue): boolean =>
  typeof value === 'string' || isPlainObject(value)

const itemKeys = (spec: KindSpec, item: JsonValue): string[] =>
  Object.entries(isPlainObject(item) ? item : {}).flatMap(([name, value]) => {
    if (name === spec.attribute) return attributeKeys(spec, value)
    return isProperty(spec) && isTagValue(value) ? [name] : []
  })

const blockKeys = (spec: KindSpec, output: JsonArray): string[] =>
  collectBlocks(output).flatMap(block =>
    [block.local, block.ancestor, block.other].flatMap(side =>
      side.flatMap(item => itemKeys(spec, item))
    )
  )

const entryOf = (spec: KindSpec, side: Side, key: string) =>
  sideOf(spec, side, key)[0]

const holdsAtMostOnce = (spec: KindSpec, sides: Side[], key: string): boolean =>
  sides.every(side => sideOf(spec, side, key).length <= 1)

// A key whose entry the sides settle between them has nothing to contest
const isSettledEntry = (
  spec: KindSpec,
  key: string,
  sides: Side[]
): boolean => {
  const [a, l, o] = sides.map(side => entryOf(spec, side, key))
  return (
    holdsAtMostOnce(spec, sides, key) &&
    entryOutcome({ a, l, o }) !== CONFLICT &&
    [a, l, o].some(entry => entry !== undefined)
  )
}

// The properties of a plain object are not entries: a side deleting the
// object contests it whole, so only a property no side touched is settled
const isUntouched = (spec: KindSpec, key: string, sides: Side[]): boolean => {
  const [fromA, fromL, fromO] = sides.map(side => sideOf(spec, side, key))
  return (
    fromA.length === 1 &&
    fromL.length === 1 &&
    fromO.length === 1 &&
    same(fromA[0], fromL[0]) &&
    same(fromL[0], fromO[0])
  )
}

// The tags the reference model draws into a block (ADR 073): the tags whose
// pairwise orders cycle, the tags both sides add where they disagree, and the
// tags a side writes between them, to a fixed point
const contestedKeys = (sides: readonly Side[]): string[] => {
  const [a, l, o] = sides.map(side => side.map(property.keyOf))
  return referenceOrder(a, l, o).blocks.flat()
}

// At the root level a contested order conflicts nowhere: the tags the
// reference draws into a block are merged one by one like the others
const isSettledProperty = (
  spec: KindSpec,
  key: string,
  sides: Side[]
): boolean =>
  isUntouched(spec, key, sides) &&
  (isRootLevel(spec) || !contestedKeys(sides).includes(key))

const isSettled = (spec: KindSpec, key: string, sides: Side[]): boolean =>
  isProperty(spec)
    ? isSettledProperty(spec, key, sides)
    : isSettledEntry(spec, key, sides)

const settledKeys = (spec: KindSpec, sides: Side[]): string[] =>
  KEYS.filter(key => isSettled(spec, key, sides))

// A conflict that holds a block while some key is untouched by every side:
// the cases where the claim has something to say
interface Contest {
  readonly inBlocks: string[]
  readonly settled: string[]
  readonly contested: boolean
}

const contestOf = (spec: KindSpec, sides: readonly Side[]): Contest => {
  const [a, l, o] = sides
  const sut = merge(spec, a, l, o)
  const inBlocks = blockKeys(spec, sut.output)
  const settled = settledKeys(spec, [a, l, o])
  return {
    inBlocks,
    settled,
    contested: sut.hasConflict && inBlocks.length > 0 && settled.length > 0,
  }
}

// A block drawn by the order of the child tags, next to a settled key: a
// conflict block for a nested element, the canonical order standing in the
// block's place for the root element
const contestsTagOrder = (spec: KindSpec, sides: readonly Side[]): boolean => {
  const [a, l, o] = sides.map(side => side.map(spec.keyOf))
  const drawsBlock = referenceOrder(a, l, o).blocks.length > 0
  if (isRootLevel(spec)) {
    return drawsBlock && settledKeys(spec, [...sides]).length > 0
  }
  return contestOf(spec, sides).contested && drawsBlock
}

const minimality = (spec: KindSpec) =>
  fc.asyncProperty(contestedSidesArb(spec), async sides => {
    // Arrange & Act
    const { inBlocks, settled, contested } = contestOf(spec, sides)

    // Assert
    fc.pre(contested)
    expect(inBlocks.filter(key => settled.includes(key))).toEqual([])
  })

const resolveTo = (node: JsonValue, side: Resolution): JsonValue => {
  if (Array.isArray(node)) {
    return node.flatMap(n =>
      isConflictBlock(n) ? resolveTo(n[side], side) : [resolveTo(n, side)]
    )
  }
  if (!isPlainObject(node)) return node
  if (isConflictBlock(node)) return resolveTo(node[side], side)
  return Object.fromEntries(
    Object.entries(node).map(([name, value]) => [name, resolveTo(value, side)])
  )
}

type Resolution = 'local' | 'other'

interface Orientation {
  readonly l: Side
  readonly o: Side
  readonly deleter: Resolution
}

const opposite = (side: Resolution): Resolution =>
  side === 'local' ? 'other' : 'local'

const entriesResolvedTo = async (
  spec: KindSpec,
  output: JsonArray,
  side: Resolution
): Promise<Side> =>
  entriesOf(spec, await render(resolveTo(output, side) as JsonArray))

const assertDeleteVsModify = async (
  spec: KindSpec,
  ancestor: Side,
  { l, o, deleter }: Orientation,
  modified: JsonValue
): Promise<void> => {
  // Act
  const sut = merge(spec, ancestor, l, o)
  const kept = await entriesResolvedTo(spec, sut.output, opposite(deleter))
  const dropped = await entriesResolvedTo(spec, sut.output, deleter)

  // Assert
  expect(sut.hasConflict).toBe(true)
  expect(kept.some(entry => same(entry, modified))).toBe(true)
  expect(dropped.map(spec.keyOf)).not.toContain(spec.keyOf(modified))
}

const deleteVsModify = (spec: KindSpec) =>
  fc.asyncProperty(replacementArb(spec), async ({ a, index, modified }) => {
    // Arrange
    const deleted = a.filter((_, j) => j !== index)
    const replaced = a.map((entry, j) => (j === index ? modified : entry))

    await assertDeleteVsModify(
      spec,
      a,
      { l: deleted, o: replaced, deleter: 'local' },
      modified
    )
    await assertDeleteVsModify(
      spec,
      a,
      { l: replaced, o: deleted, deleter: 'other' },
      modified
    )
  })

const deleteVsReorder = (spec: KindSpec) =>
  fc.asyncProperty(
    sideArb(spec)
      .filter(a => a.length > 0)
      .chain(a =>
        fc.nat({ max: a.length - 1 }).chain(index =>
          reorderedEntryArb(a[index]).map(reordered => ({
            a,
            index,
            reordered,
          }))
        )
      ),
    async ({ a, index, reordered }) => {
      // Arrange
      const deleted = a.filter((_, j) => j !== index)
      const moved = a.map((entry, j) => (j === index ? reordered : entry))

      await assertDeleteVsModify(
        spec,
        a,
        { l: deleted, o: moved, deleter: 'local' },
        reordered
      )
      await assertDeleteVsModify(
        spec,
        a,
        { l: moved, o: deleted, deleter: 'other' },
        reordered
      )
    }
  )

const elementDeletedArb = (spec: KindSpec) =>
  sideArb(spec)
    .filter(a => a.length > 0)
    .chain(a =>
      editOf(spec, a)
        .filter(
          o =>
            o.length > 0 &&
            !same(retrieveShaped(spec, o), retrieveShaped(spec, a))
        )
        .map(o => ({ a, o }))
    )

const assertElementDeleted = async (
  spec: KindSpec,
  ancestor: Side,
  { l, o, deleter }: Orientation
): Promise<void> => {
  // Act
  const sut = merge(spec, ancestor, l, o)
  const dropped = resolveTo(sut.output, deleter) as JsonArray
  const { content } = new CompactXmlParser().parseString(await render(dropped))

  // Assert
  expect(sut.hasConflict).toBe(true)
  expect(content[spec.root]).not.toHaveProperty(spec.attribute)
}

const elementDeleteVsModify = (spec: KindSpec) =>
  fc.asyncProperty(elementDeletedArb(spec), async ({ a, o }) => {
    await assertElementDeleted(spec, a, { l: [], o, deleter: 'local' })
    await assertElementDeleted(spec, a, { l: o, o: [], deleter: 'other' })
  })

// ---- a deletion against a move is never settled

interface Movement {
  readonly a: Side
  readonly entry: JsonValue
  readonly deleted: Side
  readonly moved: Side
}

const movementArb: fc.Arbitrary<Movement> = sideArb(ordered)
  .filter(a => a.length > 1)
  .chain(a =>
    fc.nat({ max: a.length - 2 }).map(index => ({
      a,
      entry: a[index],
      deleted: a.filter((_, j) => j !== index),
      moved: moveToEnd(a, index),
    }))
  )

const assertDeleteVsMove = async (
  { a, entry }: Movement,
  { l, o, deleter }: Orientation
): Promise<void> => {
  // Act
  const sut = merge(ordered, a, l, o)
  const kept = await entriesResolvedTo(ordered, sut.output, opposite(deleter))
  const dropped = await entriesResolvedTo(ordered, sut.output, deleter)

  // Assert
  expect(sut.hasConflict).toBe(true)
  expect(kept.some(found => same(found, entry))).toBe(true)
  expect(dropped.map(ordered.keyOf)).not.toContain(ordered.keyOf(entry))
}

const deleteVsMove = fc.asyncProperty(movementArb, async movement => {
  await assertDeleteVsMove(movement, {
    l: movement.deleted,
    o: movement.moved,
    deleter: 'local',
  })
  await assertDeleteVsMove(movement, {
    l: movement.moved,
    o: movement.deleted,
    deleter: 'other',
  })
})

// ---- ordered blocks

const wrapSide = (side: Side): JsonArray =>
  side.map(entry => ({ [ordered.attribute]: entry }))

const renderSide = (side: JsonArray): Promise<string> =>
  render([{ [ordered.root]: side }])

const windowsOf = (written: JsonArray): JsonArray[] =>
  written.flatMap((_, from) =>
    written
      .slice(from)
      .map((__, length) => written.slice(from, from + length + 1))
  )

type Omittable = (item: JsonValue) => boolean

const coversRun = (
  window: JsonArray,
  run: JsonArray,
  omittable: Omittable
): boolean => {
  if (window.length === 0) return run.length === 0
  const [head, ...rest] = window
  if (run.length > 0 && same(head, run[0])) {
    if (coversRun(rest, run.slice(1), omittable)) return true
  }
  return omittable(head) && coversRun(rest, run, omittable)
}

// An entry the other side deleted and this side left untouched is settled
// cleanly, so a block may leave it out of a side that spans it
const isContiguousRun = (
  run: JsonArray,
  written: JsonArray,
  omittable: Omittable
): boolean =>
  run.length === 0 ||
  windowsOf(written).some(window => coversRun(window, run, omittable))

// Both sides changed an entry of the same key: it is a content conflict,
// otherwise the block should have ended before it
const edgeIsContentConflict = (
  [local, other]: readonly [JsonValue, JsonValue],
  ancestor: Side
): boolean => {
  const [l, o] = [unwrap(local), unwrap(other)]
  const key = ordered.keyOf(l)
  if (key !== ordered.keyOf(o)) return true
  const a = ancestor.find(entry => ordered.keyOf(entry) === key)
  return entryOutcome({ a, l, o }) === CONFLICT
}

const blockEdges = (
  block: ConflictBlock
): (readonly [JsonValue, JsonValue])[] => {
  const [local, other] = [block.local, block.other]
  const edges = [
    [local.at(0), other.at(0)],
    [local.at(-1), other.at(-1)],
  ] as const
  return edges.flatMap(([l, o]) =>
    l === undefined || o === undefined ? [] : [[l, o] as const]
  )
}

interface BlockCase {
  readonly block: ConflictBlock
  readonly sides: readonly [Side, Side, Side]
}

const forEveryBlock = (check: (found: BlockCase) => Promise<void>) =>
  fc.asyncProperty(sidesArb(ordered), async sides => {
    // Arrange
    const [a, l, o] = sides
    const sut = merge(ordered, a, l, o)

    // Act & Assert
    for (const block of rootItems(ordered, sut.output).filter(
      isConflictBlock
    )) {
      await check({ block, sides })
    }
  })

const differingLiveSides = async ({ block }: BlockCase) => {
  expect(await renderSide(block.local)).not.toBe(await renderSide(block.other))
}

const someLiveSide = async ({ block }: BlockCase) => {
  expect(block.local.length + block.other.length).toBeGreaterThan(0)
}

// A deletion settles an entry the other side kept as it was: a reorder of the
// entry's tags is a change, so the entry it touches is contested
const settledDeletions = (side: Side, ancestor: Side, rival: Side) => {
  const rivalKeys = new Set(rival.map(ordered.keyOf))
  return (item: JsonValue) => {
    const entry = unwrap(item)
    return (
      !rivalKeys.has(ordered.keyOf(entry)) &&
      ancestor.some(original => jsonIdentical(original, entry))
    )
  }
}

const verbatimRuns = async ({ block, sides: [a, l, o] }: BlockCase) => {
  const local = isContiguousRun(
    block.local,
    wrapSide(l),
    settledDeletions(l, a, o)
  )
  const other = isContiguousRun(
    block.other,
    wrapSide(o),
    settledDeletions(o, a, l)
  )
  expect([local, other]).toEqual([true, true])
}

const zealousEdges = async ({ block, sides: [a] }: BlockCase) => {
  const misplaced = blockEdges(block).filter(
    edge => !edgeIsContentConflict(edge, a)
  )
  expect(misplaced).toEqual([])
}

const tagsOfBlockSide = (
  spec: KindSpec,
  block: ConflictBlock,
  side: Resolution
): string[] => block[side].flatMap(item => itemKeys(spec, item))

const isRunOf = (run: string[], tags: string[]): boolean =>
  tags.length === 0 ||
  run.some((_, at) => run.slice(at, at + tags.length).join() === tags.join())

// Resolving a block to a side gives that side's tags as it wrote them: they
// are one run of what the side wrote, and one run of the resolved element
const resolvedToSideVerbatim = (spec: KindSpec, side: Resolution) =>
  fc.asyncProperty(contestedSidesArb(spec), async sides => {
    // Arrange
    const [a, l, o] = sides
    const sut = merge(spec, a, l, o)
    const written = (side === 'local' ? l : o).map(spec.keyOf)
    const resolved = (await entriesResolvedTo(spec, sut.output, side)).map(
      spec.keyOf
    )

    // Act
    const blocks = collectBlocks(sut.output).map(block =>
      tagsOfBlockSide(spec, block, side)
    )

    // Assert
    expect(blocks.filter(tags => !isRunOf(written, tags))).toEqual([])
    expect(blocks.filter(tags => !isRunOf(resolved, tags))).toEqual([])
  })

// The tags of one entry, equal in value on every side and moved into orders no
// single order holds: nested, no rule decides, so the entry is one block and
// each resolution is that side's entry as it wrote it
const entryTagOrderIsOneBlock = (spec: KindSpec) =>
  fc.asyncProperty(contestedEntryOrderArb(spec), async ([a, l, o]) => {
    for (const [ours, theirs] of [
      [l, o],
      [o, l],
    ] as const) {
      // Act
      const sut = merge(spec, a, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(collectBlocks(sut.output)).toHaveLength(1)
      expect(await render(resolveTo(sut.output, 'local') as JsonArray)).toBe(
        await xmlOf(spec, ours, {})
      )
      expect(await render(resolveTo(sut.output, 'other') as JsonArray)).toBe(
        await xmlOf(spec, theirs, {})
      )
    }
  })

const bothAddATag = (spec: KindSpec, [a, l, o]: readonly Side[]): boolean => {
  const [ancestor, local, other] = [a, l, o].map(side => side.map(spec.keyOf))
  return local.some(tag => other.includes(tag) && !ancestor.includes(tag))
}

const MINIMUM_REACH = 0.25
const REACH_SAMPLES = 400
const MINIMUM_BOTH_ADDED_REACH = 0.1

describe('JsonMerger laws: smallest conflict', () => {
  describe.each([
    ['keyed', keyed],
    ['text', text],
    ['ordered', ordered],
    ['property', property],
    ['root property', rootProperty],
  ])('given %s sides', (_name, spec) => {
    it('when local and other are swapped then the merge mirrors', async () => {
      await assertLaw(symmetry(spec))
    })
  })

  describe.each([
    ['keyed', keyed],
    ['keyed without sibling', withoutSibling(keyed)],
    ['text', text],
    ['text without sibling', withoutSibling(text)],
    ['property', property],
    ['property without sibling', withoutSibling(property)],
    ['root property', rootProperty],
    ['root property without sibling', withoutSibling(rootProperty)],
  ])('given %s sides that conflict', (_name, spec) => {
    it('when a key is untouched by every side then no conflict block holds it', async () => {
      await assertLaw(minimality(spec))
    })
  })

  describe.each([
    ['property', property, 'local' as const],
    ['property', property, 'other' as const],
    ['root property', rootProperty, 'local' as const],
    ['root property', rootProperty, 'other' as const],
  ])(
    'given %s sides that conflict and a block resolved to %s',
    (_name, spec, side) => {
      it('when resolved then the block is that side as it wrote it', async () => {
        await assertLaw(resolvedToSideVerbatim(spec, side))
      })
    }
  )

  describe('given property sides whose block has to widen twice', () => {
    it('when merging then the block holds the keys the reference draws into it', () => {
      // Arrange
      const sidesOf = (keys: string) =>
        [...keys].map(key => ({ [key]: 'true' }))
      const [a, l, o] = ['EDCAB', 'DBACE', 'ADEBC'].map(sidesOf)

      // Act
      const sut = contestOf(property, [a, l, o])

      // Assert
      expect(contestedKeys([a, l, o])).not.toEqual([])
      expect([...new Set(sut.inBlocks)].sort()).toEqual(
        contestedKeys([a, l, o]).sort()
      )
    })
  })

  describe('given the generator of property sides that conflict', () => {
    it.each([
      ['nested with a sibling', property],
      ['nested without a sibling', withoutSibling(property)],
      ['root with a sibling', rootProperty],
      ['root without a sibling', withoutSibling(rootProperty)],
    ])(
      'when sampled %s then a tag-order block next to a settled key is reached often',
      (_name, spec) => {
        // Arrange
        const samples = fc.sample(contestedSidesArb(spec), REACH_SAMPLES)

        // Act
        const reached = samples.filter(sides => contestsTagOrder(spec, sides))

        // Assert
        expect(reached.length / REACH_SAMPLES).toBeGreaterThanOrEqual(
          MINIMUM_REACH
        )
      }
    )
  })

  describe.each([
    ['keyed', keyed],
    ['ordered', ordered],
    ['property', property],
    ['root property', rootProperty],
  ])(
    'given %s sides where one deletes an entry the other modifies',
    (_name, spec) => {
      it('when merging then it conflicts and each resolution keeps its side', async () => {
        await assertLaw(deleteVsModify(spec))
      })
    }
  )

  describe.each([
    ['keyed', keyed],
    ['ordered', ordered],
  ])(
    'given %s sides where one deletes an entry the other only reorders the tags of',
    (_name, spec) => {
      it('when merging then it conflicts and each resolution keeps its side', async () => {
        await assertLaw(deleteVsReorder(spec))
      })
    }
  )

  describe.each([
    ['keyed', keyed],
    ['ordered', ordered],
  ])(
    'given %s sides whose entry has the same values and its tags moved',
    (_name, spec) => {
      it('when merging then the entry is one block in both orientations, each side verbatim', async () => {
        await assertLaw(entryTagOrderIsOneBlock(spec))
      })
    }
  )

  describe.each([
    ['nested', property],
    ['root', rootProperty],
  ])('given the generator of %s property sides', (_name, spec) => {
    it('when sampled then a tag both sides add is reached often', () => {
      // Arrange
      const samples = fc.sample(contestedSidesArb(spec), REACH_SAMPLES)

      // Act
      const reached = samples.filter(sides => bothAddATag(spec, sides))

      // Assert
      expect(reached.length / REACH_SAMPLES).toBeGreaterThanOrEqual(
        MINIMUM_BOTH_ADDED_REACH
      )
    })
  })

  describe('given ordered sides where one deletes an entry the other only moves', () => {
    it('when merging then it conflicts and each resolution keeps its side', async () => {
      await assertLaw(deleteVsMove)
    })
  })

  describe('given property sides where one deletes the element the other modifies', () => {
    it('when merging then it conflicts and resolving to the deleter drops the element', async () => {
      await assertLaw(elementDeleteVsModify(property))
    })
  })

  describe('given ordered sides', () => {
    it('when a block is emitted then its live sides differ', async () => {
      await assertLaw(forEveryBlock(differingLiveSides))
    })

    it('when a block is emitted then one live side is not empty', async () => {
      await assertLaw(forEveryBlock(someLiveSide))
    })

    it('when a block is emitted then each live side is a contiguous run of its written side', async () => {
      await assertLaw(forEveryBlock(verbatimRuns))
    })

    it('when a block is emitted then entries agreed at its ends sit outside it', async () => {
      await assertLaw(forEveryBlock(zealousEdges))
    })
  })
})
