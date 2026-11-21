import { jsonIdentical } from '../../../utils/jsonEqual.js'
import type { KeyedSides, SideKeys } from '../KeyedArrayIndex.js'
import type { IdentityTies } from './identity.js'
import { isTied } from './identityComponents.js'
import {
  type KeySpan,
  type OrderedSides,
  type PerSide,
  perSide,
  SIDES,
  type SideSpans,
  sideSpans,
} from './orderedSides.js'

type Places = PerSide<number>

/** The tied components of each part between two cuts. */
export interface TieParts {
  readonly tied: readonly (readonly number[])[]
}

// Before the first entry no key reaches anywhere.
const NOWHERE = -1

// reach[i] is the furthest place on the target side (the last copy wins) of a
// key held before place i on this side.
const reachBefore = (
  keys: SideKeys,
  target: ReadonlyMap<string, KeySpan>
): readonly number[] => {
  let reach = NOWHERE
  return keys.map(key => {
    const before = reach
    reach = Math.max(reach, target.get(key)?.last ?? NOWHERE)
    return before
  })
}

const isHeldOnce = (spans: SideSpans, key: string): boolean =>
  SIDES.every(side => spans[side].get(key)?.count === 1)

// The keys counted once on every side, at their places, in ancestor order.
const heldOnce = (keys: KeyedSides, spans: SideSpans): readonly Places[] =>
  keys.ancestor.flatMap((key, ancestor) =>
    isHeldOnce(spans, key)
      ? [
          {
            ancestor,
            local: (spans.local.get(key) as KeySpan).last,
            other: (spans.other.get(key) as KeySpan).last,
          },
        ]
      : []
  )

// keptByAllStatus renders the entry without a nested merge: a side left it
// unchanged, or both changed it to one value.
const isTakenWhole = (sides: OrderedSides, at: Places): boolean => {
  const ancestor = sides.ancestor[at.ancestor]
  const local = sides.local[at.local]
  const other = sides.other[at.other]
  return (
    jsonIdentical(local, ancestor) ||
    jsonIdentical(other, ancestor) ||
    jsonIdentical(local, other)
  )
}

// A key held before the candidate on one side with a copy at or after it on
// another reaches the copy: no such key may exist, whichever pair of sides.
const cutsOf = (sides: OrderedSides): readonly Places[] => {
  const spans = sideSpans(sides.keys)
  const reach = perSide(from =>
    perSide(to => reachBefore(sides.keys[from], spans[to]))
  )
  const isReachedByNone = (at: Places): boolean =>
    SIDES.every(from => SIDES.every(to => reach[from][to][at[from]] < at[to]))
  return heldOnce(sides.keys, spans).filter(
    at => isTakenWhole(sides, at) && isReachedByNone(at)
  )
}

// Every key gets the number of cuts before its first copy on this side.
const partsAlong = (
  keys: SideKeys,
  cutPlaces: ReadonlySet<number>
): ReadonlyMap<string, number> => {
  const partOf = new Map<string, number>()
  let part = 0
  for (const [at, key] of keys.entries()) {
    if (cutPlaces.has(at)) part++
    else if (!partOf.has(key)) partOf.set(key, part)
  }
  return partOf
}

// The first side holding a key names its part.
const adoptMissing = (
  partOf: Map<string, number>,
  parts: ReadonlyMap<string, number>
): void => {
  for (const [key, part] of parts) {
    if (!partOf.has(key)) partOf.set(key, part)
  }
}

// The cuts keep every other key on one side of them on all three sides, so
// the sides agree on a key's part and the first side holding it can speak.
const partOfKeys = (
  keys: KeyedSides,
  cuts: readonly Places[]
): ReadonlyMap<string, number> => {
  const partOf = new Map<string, number>()
  for (const side of SIDES) {
    const cutPlaces = new Set(cuts.map(at => at[side]))
    adoptMissing(partOf, partsAlong(keys[side], cutPlaces))
  }
  return partOf
}

// Listed in order of first appearance: nothing depends on the order of the
// parts, the merge reads one part at a time.
const tiedOf = (
  ties: IdentityTies,
  partOf: ReadonlyMap<string, number>
): readonly (readonly number[])[] => {
  const byPart = new Map<number, number[]>()
  for (const [at, component] of ties.components.entries()) {
    if (!isTied(component)) continue
    const part = partOf.get(ties.keyOf(component.members[0])) as number
    const group = byPart.get(part)
    if (group === undefined) byPart.set(part, [at])
    else group.push(at)
  }
  return [...byPart.values()]
}

export const tiePartsOf = (
  sides: OrderedSides,
  ties: IdentityTies
): TieParts => ({
  tied: tiedOf(ties, partOfKeys(sides.keys, cutsOf(sides))),
})
