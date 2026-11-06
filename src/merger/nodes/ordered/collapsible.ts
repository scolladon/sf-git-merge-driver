import type { JsonValue } from '../../../types/jsonTypes.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import type { SideKeys } from '../KeyedArrayIndex.js'
import { LIVE_SIDES, type LiveSide } from './orderedEntry.js'
import type { OrderedSides } from './orderedSides.js'

type Side = LiveSide | 'ancestor'

const SIDES: readonly Side[] = ['ancestor', ...LIVE_SIDES]

// A key held twice on one side has copies a reading can exchange
const REPEATED_COUNT = 2

// The other side keeps every copy where the ancestor had it
const MOST_DROPPING_SIDES = 1

interface Span {
  readonly first: number
  readonly last: number
  readonly count: number
}

interface Facts {
  readonly keys: Readonly<Record<Side, SideKeys>>
  readonly spans: Readonly<Record<Side, ReadonlyMap<string, Span>>>
  readonly varied: ReadonlySet<string>
}

const spansOf = (keys: SideKeys): ReadonlyMap<string, Span> => {
  const spans = new Map<string, Span>()
  keys.forEach((key, at) => {
    const span = spans.get(key)
    spans.set(
      key,
      span === undefined
        ? { first: at, last: at, count: 1 }
        : { ...span, last: at, count: span.count + 1 }
    )
  })
  return spans
}

const copiesOn = (sides: OrderedSides): (readonly [string, JsonValue])[] =>
  SIDES.flatMap(side =>
    sides.keys[side].map((key, at) => [key, sides[side][at]] as const)
  )

// The merge reads a copy's fields in order, so copies listing them in another
// order are different values
const variedKeys = (sides: OrderedSides): ReadonlySet<string> => {
  const firstCopies = new Map<string, JsonValue>()
  const varied = new Set<string>()
  for (const [key, copy] of copiesOn(sides)) {
    if (!firstCopies.has(key)) firstCopies.set(key, copy)
    else if (!jsonIdentical(firstCopies.get(key), copy)) varied.add(key)
  }
  return varied
}

const factsOf = (sides: OrderedSides): Facts => ({
  keys: sides.keys,
  spans: {
    ancestor: spansOf(sides.keys.ancestor),
    local: spansOf(sides.keys.local),
    other: spansOf(sides.keys.other),
  },
  varied: variedKeys(sides),
})

const countOf = (facts: Facts, side: Side, key: string): number =>
  facts.spans[side].get(key)?.count ?? 0

const isRepeated = (facts: Facts, key: string): boolean =>
  SIDES.some(side => countOf(facts, side, key) >= REPEATED_COUNT)

const isAddedBy = (facts: Facts, side: Side, key: string): boolean =>
  countOf(facts, side, key) > countOf(facts, 'ancestor', key)

const isDroppedBy = (facts: Facts, side: Side, key: string): boolean =>
  countOf(facts, side, key) < countOf(facts, 'ancestor', key)

const isTogether = (facts: Facts, key: string): boolean =>
  SIDES.every(side => {
    const span = facts.spans[side].get(key)
    return span === undefined || span.last - span.first + 1 === span.count
  })

const isCore = (facts: Facts, key: string): boolean =>
  !facts.varied.has(key) &&
  isTogether(facts, key) &&
  LIVE_SIDES.every(side => !isAddedBy(facts, side, key)) &&
  LIVE_SIDES.filter(side => isDroppedBy(facts, side, key)).length <=
    MOST_DROPPING_SIDES

const neighboursOn = (
  facts: Facts,
  side: Side,
  key: string
): readonly string[] => {
  const span = facts.spans[side].get(key)
  if (span === undefined) return []
  return [span.first - 1, span.last + 1]
    .filter(at => at >= 0 && at < facts.keys[side].length)
    .map(at => facts.keys[side][at])
}

const isExempt = (facts: Facts, key: string): boolean =>
  isRepeated(facts, key) && isCore(facts, key)

// Only the side dropping copies of the key can place an insertion between
// them: the side keeping every copy holds them at fixed positions
const isQuietNeighbour = (
  facts: Facts,
  key: string,
  side: Side,
  neighbour: string
): boolean =>
  isExempt(facts, neighbour) ||
  (!(isDroppedBy(facts, side, key) && isAddedBy(facts, side, neighbour)) &&
    !LIVE_SIDES.some(live => isDroppedBy(facts, live, neighbour)))

const isQuiet = (facts: Facts, key: string): boolean =>
  SIDES.every(side =>
    neighboursOn(facts, side, key).every(neighbour =>
      isQuietNeighbour(facts, key, side, neighbour)
    )
  )

/**
 * The repeated keys whose copies the tied readings exchange, decided from the
 * sides alone: no reading is built.
 */
export const collapsibleKeys = (sides: OrderedSides): ReadonlySet<string> => {
  const facts = factsOf(sides)
  const keys = new Set(SIDES.flatMap(side => sides.keys[side]))
  return new Set(
    [...keys].filter(
      key => isRepeated(facts, key) && isCore(facts, key) && isQuiet(facts, key)
    )
  )
}
