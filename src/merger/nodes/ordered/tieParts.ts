import type { JsonObject } from '../../../types/jsonTypes.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { signatureOf } from '../../../utils/jsonSignature.js'
import type { KeyedSides, SideKeys } from '../KeyedArrayIndex.js'
import type { IdentityTies } from './identity.js'
import { isTied } from './identityComponents.js'
import type { OrderedSides } from './mergeOrdered.js'

const SIDES = ['ancestor', 'local', 'other'] as const

type Side = (typeof SIDES)[number]

type PerSide<Value> = Readonly<Record<Side, Value>>

type Places = PerSide<number>

/** The tied components of each part between two cuts, and the cuts' items. */
export interface TieParts {
  readonly tied: readonly (readonly number[])[]
  readonly cutItems: ReadonlySet<string>
}

// Before the first entry no key reaches anywhere.
const NOWHERE = -1

const perSide = <Value>(atSide: (side: Side) => Value): PerSide<Value> => ({
  ancestor: atSide('ancestor'),
  local: atSide('local'),
  other: atSide('other'),
})

// The last copy wins: the furthest place a key reaches on its side.
const lastPlaces = (keys: SideKeys): ReadonlyMap<string, number> =>
  new Map(keys.map((key, at) => [key, at]))

// reach[i] is the furthest place, on the target side, of a key held before
// place i on this side.
const reachBefore = (
  keys: SideKeys,
  last: ReadonlyMap<string, number>
): readonly number[] => {
  let reach = NOWHERE
  return keys.map(key => {
    const before = reach
    reach = Math.max(reach, last.get(key) ?? NOWHERE)
    return before
  })
}

const countsOf = (keys: SideKeys): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}

// The keys counted once on every side, at their places, in ancestor order.
const heldOnce = (
  keys: KeyedSides,
  lasts: PerSide<ReadonlyMap<string, number>>
): readonly Places[] => {
  const counts = perSide(side => countsOf(keys[side]))
  return keys.ancestor.flatMap((key, ancestor) =>
    SIDES.every(side => counts[side].get(key) === 1)
      ? [
          {
            ancestor,
            local: lasts.local.get(key) as number,
            other: lasts.other.get(key) as number,
          },
        ]
      : []
  )
}

// The value keptByAllStatus renders without a nested merge: the changed side
// when the other is unchanged, or the one value both sides changed it to.
const takenValue = (
  sides: OrderedSides,
  at: Places
): JsonObject | undefined => {
  const ancestor = sides.ancestor[at.ancestor]
  const local = sides.local[at.local] as JsonObject
  if (jsonIdentical(local, ancestor)) return sides.other[at.other] as JsonObject
  const other = sides.other[at.other]
  return jsonIdentical(other, ancestor) || jsonIdentical(local, other)
    ? local
    : undefined
}

interface Cut {
  readonly at: Places
  readonly value: JsonObject
}

// A key held before the candidate on one side with a copy at or after it on
// another reaches the copy: no such key may exist, whichever pair of sides.
const cutsOf = (sides: OrderedSides): readonly Cut[] => {
  const lasts = perSide(side => lastPlaces(sides.keys[side]))
  const reach = perSide(from =>
    perSide(to => reachBefore(sides.keys[from], lasts[to]))
  )
  const isReachedByNone = (at: Places): boolean =>
    SIDES.every(from => SIDES.every(to => reach[from][to][at[from]] < at[to]))
  return heldOnce(sides.keys, lasts).flatMap(at => {
    const value = takenValue(sides, at)
    return value !== undefined && isReachedByNone(at) ? [{ at, value }] : []
  })
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

// The cuts keep every other key on one side of them on all three sides, so
// the sides agree on a key's part and the first side holding it can speak.
const partOfKeys = (
  keys: KeyedSides,
  cuts: readonly Places[]
): ReadonlyMap<string, number> => {
  const partOf = new Map<string, number>()
  for (const side of SIDES) {
    const cutPlaces = new Set(cuts.map(at => at[side]))
    for (const [key, part] of partsAlong(keys[side], cutPlaces)) {
      if (!partOf.has(key)) partOf.set(key, part)
    }
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
  ties: IdentityTies,
  attribute: string
): TieParts => {
  const cuts = cutsOf(sides)
  const places = cuts.map(({ at }) => at)
  return {
    tied: tiedOf(ties, partOfKeys(sides.keys, places)),
    cutItems: new Set(
      cuts.map(({ value }) => signatureOf({ [attribute]: value }))
    ),
  }
}
