import type { JsonObject } from '../../../types/jsonTypes.js'

export type LiveSide = 'local' | 'other'

export const LIVE_SIDES: readonly LiveSide[] = ['local', 'other']

export const ABSENT_POSITION = -1

export interface OrderedEntry {
  readonly id: number
  readonly key: string
  readonly ancestor?: JsonObject
  readonly local?: JsonObject
  readonly other?: JsonObject
  readonly ancestorPos: number
  readonly localPos: number
  readonly otherPos: number
}

export type Reading = readonly OrderedEntry[]

export const positionOn = (entry: OrderedEntry, side: LiveSide): number => {
  switch (side) {
    case 'local':
      return entry.localPos
    case 'other':
      return entry.otherPos
  }
}

export const valueOn = (
  entry: OrderedEntry,
  side: LiveSide
): JsonObject | undefined => {
  switch (side) {
    case 'local':
      return entry.local
    case 'other':
      return entry.other
  }
}

export const isOn = (entry: OrderedEntry, side: LiveSide): boolean =>
  valueOn(entry, side) !== undefined

export const otherSideOf = (side: LiveSide): LiveSide => {
  switch (side) {
    case 'local':
      return 'other'
    case 'other':
      return 'local'
  }
}

/**
 * The entries the side holds in the order it wrote them. Written positions
 * are array indexes: placing each entry at its own skips the sort.
 */
export const writtenOn = (entries: Reading, side: LiveSide): Reading => {
  const slots: OrderedEntry[] = []
  for (const entry of entries) {
    if (isOn(entry, side)) slots[positionOn(entry, side)] = entry
  }
  return Object.values(slots)
}
