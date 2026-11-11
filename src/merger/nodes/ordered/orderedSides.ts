import type { JsonArray } from '../../../types/jsonTypes.js'
import type { KeyedSides, SideKeys } from '../KeyedArrayIndex.js'
import { LIVE_SIDES, type LiveSide } from './orderedEntry.js'

/**
 * The three sides of an ordered array, with the key of every entry. A key is
 * read from its entry: two entries of equal content hold the same key.
 */
export interface OrderedSides {
  readonly ancestor: JsonArray
  readonly local: JsonArray
  readonly other: JsonArray
  readonly keys: KeyedSides
}

export type Side = LiveSide | 'ancestor'

export const SIDES: readonly Side[] = ['ancestor', ...LIVE_SIDES]

export type PerSide<Value> = Readonly<Record<Side, Value>>

export const perSide = <Value>(
  atSide: (side: Side) => Value
): PerSide<Value> => ({
  ancestor: atSide('ancestor'),
  local: atSide('local'),
  other: atSide('other'),
})

/** Where a key's copies stand on one side: first and last place, and count. */
export interface KeySpan {
  readonly first: number
  readonly last: number
  readonly count: number
}

const keySpans = (keys: SideKeys): ReadonlyMap<string, KeySpan> => {
  const spans = new Map<string, KeySpan>()
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

export type SideSpans = PerSide<ReadonlyMap<string, KeySpan>>

export const sideSpans = (keys: KeyedSides): SideSpans =>
  perSide(side => keySpans(keys[side]))

/** The sides' entries wrapped under the attribute, as the output lists them. */
export type Wrapped = PerSide<JsonArray>

export const wrapAll = (attribute: string, side: JsonArray): JsonArray =>
  side.map(entry => ({ [attribute]: entry }))

export const wrapSides = (sides: OrderedSides, attribute: string): Wrapped =>
  perSide(side => wrapAll(attribute, sides[side]))
