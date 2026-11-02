import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { JsonMerger } from '../../../../src/merger/JsonMerger.js'
import {
  type ConflictBlock,
  isConflictBlock,
} from '../../../../src/types/conflictBlock.js'
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '../../../../src/types/jsonTypes.js'
import {
  asItems,
  assertLaw,
  isPlainObject,
  isProperty,
  isText,
  KEYS,
  type KindSpec,
  keyed,
  merge,
  ordered,
  permArb,
  property,
  render,
  retrieveShaped,
  rootItems,
  type Side,
  same,
  sidesArb,
  splitFieldsArb,
  text,
  unwrap,
} from './arbitraries.js'

// ---- one entry edited in different fields

const fieldwiseMerge = (spec: KindSpec) =>
  fc.asyncProperty(splitFieldsArb(spec), async split => {
    // Arrange
    const [a, l, o, both] = [split.a, split.l, split.o, split.both].map(side =>
      retrieveShaped(spec, side)
    )
    const expected = merge(spec, both, both, both)

    // Act
    const sut = merge(spec, a, l, o)

    // Assert
    expect(sut.hasConflict).toBe(false)
    expect(await render(sut.output)).toBe(await render(expected.output))
  })

// ---- relabel invariance

type Relabeling = ReadonlyMap<string, string>

const labelFor = (map: Relabeling, key: string): string => map.get(key) ?? key

const relabelSide = (spec: KindSpec, side: Side, map: Relabeling): Side =>
  side.map(entry => spec.relabel(entry, labelFor(map, spec.keyOf(entry))))

const relabelPair = (
  spec: KindSpec,
  [name, value]: [string, JsonValue],
  map: Relabeling
): [string, JsonValue] => {
  if (name === spec.keyProperty && typeof value === 'string') {
    return [name, labelFor(map, value)]
  }
  if (isProperty(spec)) {
    return [labelFor(map, name), relabelOutput(spec, value, map)]
  }
  return [name, relabelOutput(spec, value, map)]
}

const relabelOutput = (
  spec: KindSpec,
  node: JsonValue,
  map: Relabeling
): JsonValue => {
  if (Array.isArray(node)) return node.map(n => relabelOutput(spec, n, map))
  if (typeof node === 'string') {
    return isText(spec)
      ? spec.relabel(node, labelFor(map, spec.keyOf(node)))
      : node
  }
  if (!isPlainObject(node)) return node
  return Object.fromEntries(
    Object.entries(node).map(pair => relabelPair(spec, pair, map))
  )
}

const tokensOf = (spec: KindSpec, item: JsonValue): string[] => {
  if (isConflictBlock(item)) return [blockToken(spec, item)]
  const content = (item as JsonObject)[spec.attribute]
  if (isProperty(spec) && content !== undefined) {
    return asItems(content).flatMap(inner => tokensOf(spec, inner))
  }
  return [JSON.stringify(item)]
}

const sortedIfUnordered = (spec: KindSpec, tokens: string[]): string[] =>
  spec.emission === 'sorted' ? [...tokens].sort() : tokens

const blockToken = (spec: KindSpec, block: ConflictBlock): string => {
  const sideToken = (side: JsonArray) =>
    sortedIfUnordered(
      spec,
      side.flatMap(item => tokensOf(spec, item))
    ).join(',')
  const [l, a, o] = [block.local, block.ancestor, block.other].map(sideToken)
  return `<${l}|${a}|${o}>`
}

// Sorted kinds are emitted in key order, which a relabeling changes
const summary = (spec: KindSpec, output: JsonArray): string[] =>
  sortedIfUnordered(
    spec,
    rootItems(spec, output).flatMap(item => tokensOf(spec, item))
  )

const relabeling = (perm: readonly string[]): Relabeling =>
  new Map(KEYS.map((key, i) => [key, perm[i]]))

// Names every object inherits, one per key: a read that is not an own read
// makes a relabeled merge differ from the plain one
const INHERITED_NAMES = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
]

const inheritedNamesArb = fc.shuffledSubarray(INHERITED_NAMES, {
  minLength: INHERITED_NAMES.length,
  maxLength: INHERITED_NAMES.length,
})

const relabel = (spec: KindSpec, labels: fc.Arbitrary<string[]> = permArb) =>
  fc.asyncProperty(sidesArb(spec), labels, async ([a, l, o], perm) => {
    // Arrange
    const map = relabeling(perm)
    const base = merge(spec, a, l, o)
    const [ra, rl, ro] = [a, l, o].map(side => relabelSide(spec, side, map))

    // Act
    const sut = merge(spec, ra, rl, ro)

    // Assert
    const expected = relabelOutput(spec, base.output, map) as JsonArray
    expect(sut.hasConflict).toBe(base.hasConflict)
    expect(summary(spec, sut.output)).toEqual(summary(spec, expected))
  })

const fullNames = (value: JsonValue): string[] => {
  if (Array.isArray(value)) return value.flatMap(fullNames)
  const name = isPlainObject(value) ? value['fullName'] : undefined
  return typeof name === 'string' ? [name] : []
}

const identitiesOf = (item: JsonValue): string[] => {
  if (!isConflictBlock(item)) return fullNames(unwrap(item))
  const sides = [item.local, item.ancestor, item.other]
  return [...new Set(sides.flatMap(side => side.flatMap(identitiesOf)))]
}

const isEntryOrBlock = (item: JsonValue): boolean =>
  isConflictBlock(item) || (isPlainObject(item) && ordered.attribute in item)

const identityOnce = fc.asyncProperty(sidesArb(ordered), async ([a, l, o]) => {
  // Arrange
  const sut = merge(ordered, a, l, o)

  // Act
  const identities = rootItems(ordered, sut.output)
    .filter(isEntryOrBlock)
    .flatMap(identitiesOf)

  // Assert
  expect(identities.slice().sort()).toEqual([...new Set(identities)].sort())
})

describe('JsonMerger laws: identity', () => {
  describe.each([
    ['keyed', keyed],
    ['text', text],
    ['ordered', ordered],
    ['property', property],
  ])('given %s sides', (_name, spec) => {
    it('when a key is relabeled everywhere then the merge is relabeled the same way', async () => {
      await assertLaw(relabel(spec))
    })
  })

  describe('given property sides', () => {
    it('when the tags are relabeled onto the names every object inherits then the merge is relabeled the same way', async () => {
      await assertLaw(relabel(property, inheritedNamesArb))
    })
  })

  describe.each([
    ['keyed', keyed],
    ['ordered', ordered],
  ])('given %s sides editing different fields of one entry', (_name, spec) => {
    it('when merging then the merge is clean and keeps both edits', async () => {
      await assertLaw(fieldwiseMerge(spec))
    })
  })

  describe('given ordered sides', () => {
    it('when merging then each identity appears once, a block counting once', async () => {
      await assertLaw(identityOnce)
    })
  })
})
