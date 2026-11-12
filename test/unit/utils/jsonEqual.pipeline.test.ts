import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  jsonEqual,
  jsonIdentical,
  jsonIdenticalUpToAttributeOrder,
} from '../../../src/utils/jsonEqual.js'
import * as pairStack from '../../utils/oracles/pairStackEqual.js'
import {
  dupSidesArb,
  KEYS,
  type KindSpec,
  keyed,
  ordered,
  property,
  reorderedEntryArb,
  type Side,
  sideArb,
  sidesArb,
  text,
} from '../merger/laws/arbitraries.js'

type Pair = readonly [unknown, unknown]
type Equality = (a: unknown, b: unknown) => boolean

const EQUALITIES: readonly (readonly [Equality, Equality])[] = [
  [jsonEqual, pairStack.jsonEqual],
  [jsonIdentical, pairStack.jsonIdentical],
  [jsonIdenticalUpToAttributeOrder, pairStack.jsonIdenticalUpToAttributeOrder],
]

const SPECS: readonly KindSpec[] = [keyed, ordered, text, property]
// Deep and wide enough to hold lists of maps of lists, small enough that the
// shrinker ends on a readable pair
const MAX_DEPTH = 3
const MAX_ITEMS = 3
const MAX_MEMBERS = 4

const pairOfSides = (sides: readonly [Side, Side, Side]): fc.Arbitrary<Pair> =>
  fc.tuple(fc.constantFrom(...sides), fc.constantFrom(...sides))

const reorderedPairArb = (spec: KindSpec): fc.Arbitrary<Pair> =>
  fc
    .constantFrom(...KEYS)
    .chain(spec.entry)
    .chain(entry =>
      reorderedEntryArb(entry).map(reordered => [entry, reordered] as const)
    )

const leafArb = fc.constantFrom<unknown>(
  'true',
  'false',
  '',
  'a',
  0,
  1,
  -0,
  Number.NaN,
  null,
  true,
  undefined
)
const nameArb = fc.constantFrom('field', 'value', '@_id', '@_xsi:nil', 'length')

const nullPrototyped = (entries: [string, unknown][]): object =>
  Object.assign(Object.create(null), Object.fromEntries(entries))

const { value: valueArb } = fc.letrec<{ value: unknown }>(tie => ({
  value: fc.oneof(
    { depthSize: 'small', maxDepth: MAX_DEPTH },
    leafArb,
    fc.array(tie('value'), { maxLength: MAX_ITEMS }),
    fc
      .tuple(
        fc.uniqueArray(fc.tuple(nameArb, tie('value')), {
          maxLength: MAX_MEMBERS,
          selector: ([name]) => name,
        }),
        fc.boolean()
      )
      .map(([entries, bare]) =>
        bare ? nullPrototyped(entries) : Object.fromEntries(entries)
      )
  ),
}))

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// New objects all the way down, so a pair is never settled by `===` alone
const twin = (value: unknown, reversed: boolean): unknown => {
  if (Array.isArray(value)) return value.map(item => twin(item, reversed))
  if (!isMap(value)) return value
  const entries: [string, unknown][] = Object.keys(value).map(key => [
    key,
    twin(value[key], reversed),
  ])
  if (reversed) entries.reverse()
  return Object.getPrototypeOf(value) === null
    ? nullPrototyped(entries)
    : Object.fromEntries(entries)
}

const mutated = (value: unknown, patch: unknown): unknown => {
  const copy = twin(value, false)
  if (Array.isArray(copy)) return [...copy, patch]
  if (isMap(copy)) return { ...copy, value: patch }
  return patch
}

const valuePairArb: fc.Arbitrary<Pair> = valueArb.chain(left =>
  fc.oneof(
    fc.constant([left, left] as const),
    fc.boolean().map(reversed => [left, twin(left, reversed)] as const),
    valueArb.map(patch => [left, mutated(left, patch)] as const),
    valueArb.map(right => [left, right] as const)
  )
)

const pairArb: fc.Arbitrary<Pair> = fc.oneof(
  ...SPECS.map(spec => fc.tuple(sideArb(spec), sideArb(spec))),
  ...SPECS.map(spec => sidesArb(spec).chain(pairOfSides)),
  dupSidesArb(keyed).chain(pairOfSides),
  reorderedPairArb(keyed),
  reorderedPairArb(ordered),
  valuePairArb
)

describe('jsonEqual', () => {
  describe('given two values', () => {
    describe('when compared in either order', () => {
      it('then each of the three equalities answers as the pair-stack walk', () => {
        fc.assert(
          fc.property(pairArb, ([left, right]) => {
            for (const [sut, oracle] of EQUALITIES) {
              // Arrange
              const expected = [oracle(left, right), oracle(right, left)]

              // Act
              const result = [sut(left, right), sut(right, left)]

              // Assert
              expect(result).toEqual(expected)
            }
          })
        )
      })
    })
  })
})
