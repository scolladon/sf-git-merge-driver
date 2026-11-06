import type { JsonValue } from '../../../types/jsonTypes.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import type { KeyedSides } from '../KeyedArrayIndex.js'
import { LIVE_SIDES } from './orderedEntry.js'
import {
  type OrderedSides,
  SIDES,
  type Side,
  type SideSpans,
  sideSpans,
} from './orderedSides.js'

// A key held twice on one side has copies a reading can exchange
const REPEATED_COUNT = 2

// The other side keeps every copy where the ancestor had it
const MOST_DROPPING_SIDES = 1

interface Facts {
  readonly keys: KeyedSides
  readonly spans: SideSpans
  readonly varied: ReadonlySet<string>
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
  spans: sideSpans(sides.keys),
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
    [...keys].filter(key => isExempt(facts, key) && isQuiet(facts, key))
  )
}
