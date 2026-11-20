import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { JsonMerger } from '../../../../src/merger/JsonMerger.js'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'
import {
  assertLaw,
  CONFLICT,
  entriesOf,
  isPlainObject,
  KEYS,
  type KindSpec,
  keyed,
  merge,
  REMOVED,
  render,
  type Side,
  same,
  sideOf,
  text,
} from './arbitraries.js'

// Per key, the sides hold a different number of copies of one value, which
// is what makes several identity readings possible; most keys are left alone
// so the other keys do not conflict and the merge stays clean
const MAX_KEY_COPIES = 3
const QUIET_KEY_WEIGHT = 1
const CONTESTED_KEY_WEIGHT = 1
const MIXED_VALUES_WEIGHT = 1
const SAME_VALUE_WEIGHT = 4

const copiesOf = (values: Side, count: number): Side =>
  Array.from({ length: count }, (_, i) => values[i % values.length])

const sidesOfKey = (
  values: Side,
  counts: readonly number[]
): readonly [Side, Side, Side] => [
  copiesOf(values, counts[0]),
  copiesOf(values, counts[1]),
  copiesOf(values, counts[2]),
]

const valuesOfKeyArb = (spec: KindSpec, key: string): fc.Arbitrary<Side> =>
  fc.oneof(
    {
      weight: SAME_VALUE_WEIGHT,
      arbitrary: spec.entry(key).map(entry => [entry]),
    },
    {
      weight: MIXED_VALUES_WEIGHT,
      arbitrary: fc.tuple(spec.entry(key), spec.entry(key)),
    }
  )

const countsArb = fc.tuple(
  ...Array.from({ length: 3 }, () => fc.nat({ max: MAX_KEY_COPIES }))
)

const quietKeyArb = (
  spec: KindSpec,
  key: string
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(valuesOfKeyArb(spec, key), fc.integer({ min: 0, max: 2 }))
    .map(([values, count]) => sidesOfKey(values, [count, count, count]))

const contestedKeyArb = (
  spec: KindSpec,
  key: string
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(valuesOfKeyArb(spec, key), countsArb)
    .map(([values, counts]) => sidesOfKey(values, counts))

const repeatedKeySidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(
      ...KEYS.map(key =>
        fc.oneof(
          { weight: QUIET_KEY_WEIGHT, arbitrary: quietKeyArb(spec, key) },
          {
            weight: CONTESTED_KEY_WEIGHT,
            arbitrary: contestedKeyArb(spec, key),
          }
        )
      )
    )
    .map(perKey => [
      perKey.flatMap(([a]) => a),
      perKey.flatMap(([, l]) => l),
      perKey.flatMap(([, , o]) => o),
    ])

interface Slot {
  readonly pos: number
  readonly tok: string
}
type Pair = readonly [number, number]
type Pairing = readonly Pair[]

interface Search {
  readonly xs: readonly Slot[]
  readonly ys: readonly Slot[]
  readonly found: Pairing[]
}

const freeIndices = (
  search: Search,
  j: number,
  used: ReadonlySet<number>,
  acc: Pairing
): number[] =>
  acc.some(([, y]) => y === j)
    ? []
    : search.xs.map((_, i) => i).filter(i => !used.has(i))

const freePhase = (
  search: Search,
  j: number,
  used: ReadonlySet<number>,
  acc: Pairing
): void => {
  if (j === search.ys.length) {
    search.found.push(acc)
    return
  }
  const free = freeIndices(search, j, used, acc)
  if (free.length === 0) return freePhase(search, j + 1, used, acc)
  for (const i of free) {
    freePhase(search, j + 1, new Set([...used, i]), [...acc, [i, j]])
  }
}

// Copies of one value are interchangeable and never cross: a side's copies
// take ancestor copies in order
const unusedCopies = (
  search: Search,
  tok: string,
  used: ReadonlySet<number>
): number[] =>
  search.xs.flatMap((x, i) => (!used.has(i) && x.tok === tok ? [i] : []))

const identicalPhase = (
  search: Search,
  j: number,
  used: ReadonlySet<number>,
  acc: Pairing,
  last: ReadonlyMap<string, number>
): void => {
  if (j === search.ys.length) return freePhase(search, 0, used, acc)
  const { tok } = search.ys[j]
  const unused = unusedCopies(search, tok, used)
  if (unused.length === 0) {
    return identicalPhase(search, j + 1, used, acc, last)
  }
  for (const i of unused.filter(copy => copy > (last.get(tok) ?? -1))) {
    const taken = new Map([...last, [tok, i]])
    const next = [...acc, [i, j]] as Pairing
    identicalPhase(search, j + 1, new Set([...used, i]), next, taken)
  }
}

const matchings = (xs: readonly Slot[], ys: readonly Slot[]): Pairing[] => {
  const search: Search = { xs, ys, found: [] }
  identicalPhase(search, 0, new Set(), [], new Map())
  return search.found
}

const slotsOf = (side: Side): Slot[] =>
  side.map((entry, pos) => ({ pos, tok: JSON.stringify(entry) }))

interface Ent {
  readonly a: JsonValue | undefined
  readonly l: JsonValue | undefined
  readonly o: JsonValue | undefined
}
type Outcome = JsonValue | typeof CONFLICT | typeof REMOVED

const threeWay = (a: JsonValue, l: JsonValue, o: JsonValue): Outcome => {
  if (same(l, a)) return o
  if (same(o, a) || same(l, o)) return l
  return CONFLICT
}

const fieldWise = (a: JsonObject, l: JsonObject, o: JsonObject): Outcome => {
  const merged: JsonObject = {}
  for (const field of Object.keys(a)) {
    const outcome = threeWay(a[field], l[field], o[field])
    if (outcome === CONFLICT) return CONFLICT
    merged[field] = outcome as JsonValue
  }
  return merged
}

const elementMerge = (a: JsonValue, l: JsonValue, o: JsonValue): Outcome =>
  isPlainObject(a)
    ? fieldWise(a, l as JsonObject, o as JsonObject)
    : threeWay(a, l, o)

const presentWithAncestor = (a: JsonValue, side: JsonValue): Outcome =>
  same(side, a) ? REMOVED : CONFLICT

const entryOutcome = ({ a, l, o }: Ent): Outcome => {
  if (a !== undefined && l !== undefined && o !== undefined) {
    return elementMerge(a, l, o)
  }
  if (a !== undefined) {
    const kept = l ?? o
    return kept === undefined ? REMOVED : presentWithAncestor(a, kept)
  }
  if (l !== undefined && o !== undefined) return same(l, o) ? l : CONFLICT
  return (l ?? o) as JsonValue
}

type KeyReading = readonly string[] | typeof CONFLICT

const outcomeOf = (ents: readonly Ent[]): KeyReading => {
  const outcomes = ents.map(entryOutcome)
  if (outcomes.includes(CONFLICT)) return CONFLICT
  return outcomes
    .filter(outcome => outcome !== REMOVED)
    .map(outcome => JSON.stringify(outcome))
    .sort()
}

interface KeySides {
  readonly as: Side
  readonly ls: Side
  readonly os: Side
}

const pick = (pairs: Pairing, index: number, side: Side) => {
  const pair = pairs.find(([x]) => x === index)
  return pair === undefined ? undefined : side[pair[1]]
}

const leftover = (side: Side, pairs: Pairing): Side =>
  side.filter((_, j) => !pairs.some(([, y]) => y === j))

const insertedEnts = (restL: Side, restO: Side, pairs: Pairing): Ent[] => [
  ...pairs.map(([i, j]) => ({ a: undefined, l: restL[i], o: restO[j] })),
  ...restL
    .filter((_, r) => !pairs.some(([i]) => i === r))
    .map(l => ({ a: undefined, l, o: undefined })),
  ...restO
    .filter((_, r) => !pairs.some(([, j]) => j === r))
    .map(o => ({ a: undefined, l: undefined, o })),
]

const readingsGiven = (
  { as, ls, os }: KeySides,
  ml: Pairing,
  mo: Pairing
): KeyReading[] => {
  const kept = as.map((a, i) => ({ a, l: pick(ml, i, ls), o: pick(mo, i, os) }))
  const [restL, restO] = [leftover(ls, ml), leftover(os, mo)]
  return [...matchings(slotsOf(restL), slotsOf(restO))].map(pairs =>
    outcomeOf([...kept, ...insertedEnts(restL, restO, pairs)])
  )
}

const readingsOfKey = (sides: KeySides): KeyReading[] => {
  const [slotsA, slotsL, slotsO] = [sides.as, sides.ls, sides.os].map(slotsOf)
  return [...matchings(slotsA, slotsL)].flatMap(ml =>
    [...matchings(slotsA, slotsO)].flatMap(mo => readingsGiven(sides, ml, mo))
  )
}

// A key whose two live sides agree, or where one side did not touch it, is
// taken as written whatever the readings
const agreedSide = ({ as, ls, os }: KeySides): Side | undefined => {
  if (same(ls, os)) return ls
  if (same(as, ls)) return os
  return same(as, os) ? ls : undefined
}

const expectedForKey = (sides: KeySides, key: string): string[] => {
  const agreed = agreedSide(sides)
  if (agreed !== undefined) return agreed.map(entry => JSON.stringify(entry))
  const readings = readingsOfKey(sides)
  expect(readings, `a reading of ${key} conflicts`).not.toContain(CONFLICT)
  const distinct = new Set(readings.map(reading => String(reading)))
  expect(distinct.size, `readings of ${key} differ`).toBe(1)
  return [...(readings[0] as readonly string[])]
}

const expectedReadings = (spec: KindSpec, sides: readonly Side[]): string[] =>
  KEYS.flatMap(key => {
    const [as, ls, os] = sides.map(side => sideOf(spec, side, key))
    return expectedForKey({ as, ls, os }, key)
  })

const everyReadingAgrees = (spec: KindSpec) =>
  fc.asyncProperty(repeatedKeySidesArb(spec), async ([a, l, o]) => {
    // Arrange
    const sut = merge(spec, a, l, o)
    fc.pre(!sut.hasConflict)
    const expected = expectedReadings(spec, [a, l, o])

    // Act
    const got = entriesOf(spec, await render(sut.output))

    // Assert
    expect(got.map(entry => JSON.stringify(entry)).sort()).toEqual(
      expected.sort()
    )
  })

describe('JsonMerger laws: no silent guess', () => {
  describe.each([
    ['keyed', keyed],
    ['text', text],
  ])('given %s sides repeating a key', (_name, spec) => {
    it('when the merge is clean then every identity reading yields the output', async () => {
      await assertLaw(everyReadingAgrees(spec))
    })
  })
})
