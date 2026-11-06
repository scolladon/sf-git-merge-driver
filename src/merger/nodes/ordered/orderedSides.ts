import type { JsonArray } from '../../../types/jsonTypes.js'
import type { KeyedSides } from '../KeyedArrayIndex.js'

/** The three sides of an ordered array, with the key of every entry. */
export interface OrderedSides {
  readonly ancestor: JsonArray
  readonly local: JsonArray
  readonly other: JsonArray
  readonly keys: KeyedSides
}

/** The sides' entries wrapped under the attribute, as the output lists them. */
export type Wrapped = Pick<OrderedSides, 'ancestor' | 'local' | 'other'>

export const wrapAll = (attribute: string, side: JsonArray): JsonArray =>
  side.map(entry => ({ [attribute]: entry }))

export const wrapSides = (sides: OrderedSides, attribute: string): Wrapped => ({
  ancestor: wrapAll(attribute, sides.ancestor),
  local: wrapAll(attribute, sides.local),
  other: wrapAll(attribute, sides.other),
})
