import {
  ABSENT_POSITION,
  type LiveSide,
  type OrderedEntry,
  type Reading,
} from '../../src/merger/nodes/ordered/orderedEntry.js'
import { toEntry } from './orderedTokens.js'

// A declarative statement of the identity readings, written from the rules
// alone: it shares no code with src/merger/nodes/ordered/identity.ts or
// keyedReadings.ts.
//
// - Identical copies pair first: for each value, the first min(copies on the
//   anchor, copies on the side) side copies pair with an increasing choice of
//   anchor copies.
// - The remaining side copies, in side order, take any arrangement of the
//   remaining anchor copies; the surplus is new.
// - The two live sides pair against the ancestor, then the copies neither
//   paired pair local with other by the same rules, the longer list being
//   the anchor.
// - Keys are independent: a reading is one choice per key.
// - Readings where the sides kept different copies of a value both hold are
//   dropped when a reading where they kept the same copy exists; then only
//   the readings with the fewest moves stay.

const KEYLESS_PREFIX = '~'
const EDIT_MARKS = /[*+]+$/

// A keyless token is its own identity, edit marks included: editing it is
// another content, not the same entry changed.
export const keyOfToken = (token: string): string =>
  token.startsWith(KEYLESS_PREFIX) ? token : token.replace(EDIT_MARKS, '')

interface Slot {
  readonly token: string
  readonly pos: number
}

interface Pair {
  readonly anchor: number
  readonly side: number
}

interface Row {
  readonly key: string
  readonly ancestor: Slot | undefined
  readonly local: Slot | undefined
  readonly other: Slot | undefined
}

const subsetsOf = <T>(items: readonly T[], size: number): T[][] =>
  size === 0
    ? [[]]
    : items.flatMap((item, index) =>
        subsetsOf(items.slice(index + 1), size - 1).map(rest => [item, ...rest])
      )

const arrangementsOf = <T>(items: readonly T[], size: number): T[][] =>
  size === 0
    ? [[]]
    : items.flatMap((item, index) =>
        arrangementsOf(
          [...items.slice(0, index), ...items.slice(index + 1)],
          size - 1
        ).map(rest => [item, ...rest])
      )

// One alternative per slot, concatenated, for every combination of slots
const combine = <T>(slots: readonly (readonly T[][])[]): T[][] =>
  slots.reduce<T[][]>(
    (done, alternatives) =>
      done.flatMap(prefix =>
        alternatives.map(alternative => [...prefix, ...alternative])
      ),
    [[]]
  )

const indexesOf = (slots: readonly Slot[], token: string): number[] =>
  slots.flatMap((slot, index) => (slot.token === token ? [index] : []))

const identicalPairs = (
  anchors: readonly Slot[],
  side: readonly Slot[]
): Pair[][] => {
  const tokens = [...new Set(side.map(slot => slot.token))]
  const perToken = tokens.map(token => {
    const sideIndexes = indexesOf(side, token)
    const anchorIndexes = indexesOf(anchors, token)
    const size = Math.min(sideIndexes.length, anchorIndexes.length)
    return subsetsOf(anchorIndexes, size).map(chosen =>
      chosen.map((anchor, rank) => ({
        anchor,
        side: sideIndexes[rank] as number,
      }))
    )
  })
  return combine(perToken).map(pairs =>
    [...pairs].sort((left, right) => left.side - right.side)
  )
}

const unpaired = (
  size: number,
  pairs: readonly Pair[],
  axis: keyof Pair
): number[] =>
  Array.from({ length: size }, (_, index) => index).filter(
    index => !pairs.some(pair => pair[axis] === index)
  )

const pairings = (anchors: readonly Slot[], side: readonly Slot[]): Pair[][] =>
  identicalPairs(anchors, side).flatMap(identical => {
    const freeAnchors = unpaired(anchors.length, identical, 'anchor')
    const freeSide = unpaired(side.length, identical, 'side')
    const size = Math.min(freeAnchors.length, freeSide.length)
    return arrangementsOf(freeAnchors, size).map(chosen => [
      ...identical,
      ...chosen.map((anchor, rank) => ({
        anchor,
        side: freeSide[rank] as number,
      })),
    ])
  })

const flipped = (pairs: readonly Pair[]): Pair[] =>
  pairs.map(({ anchor, side }) => ({ anchor: side, side: anchor }))

// The longer list plays the anchor whichever side it is: which of its copies
// pair is the reading.
const pairingsOfLongest = (
  local: readonly Slot[],
  other: readonly Slot[]
): Pair[][] =>
  local.length >= other.length
    ? pairings(local, other)
    : pairings(other, local).map(flipped)

interface KeySlots {
  readonly key: string
  readonly ancestor: readonly Slot[]
  readonly local: readonly Slot[]
  readonly other: readonly Slot[]
}

const slotsOfKey = (tokens: readonly string[], key: string): Slot[] =>
  tokens.flatMap((token, pos) =>
    keyOfToken(token) === key ? [{ token, pos }] : []
  )

const sideSlotFor = (
  slots: readonly Slot[],
  pairs: readonly Pair[],
  anchor: number
): Slot | undefined => {
  const pair = pairs.find(candidate => candidate.anchor === anchor)
  return pair && slots[pair.side]
}

const restOf = (slots: readonly Slot[], pairs: readonly Pair[]): Slot[] =>
  unpaired(slots.length, pairs, 'side').map(index => slots[index] as Slot)

const row = (
  key: string,
  slots: Pick<Row, 'ancestor' | 'local' | 'other'>
): Row => ({ key, ...slots })

interface KeyChoice {
  readonly group: KeySlots
  readonly withLocal: readonly Pair[]
  readonly withOther: readonly Pair[]
  readonly restLocal: readonly Slot[]
  readonly restOther: readonly Slot[]
  readonly between: readonly Pair[]
}

const keptRows = ({ group, withLocal, withOther }: KeyChoice): Row[] =>
  group.ancestor.map((ancestor, anchor) =>
    row(group.key, {
      ancestor,
      local: sideSlotFor(group.local, withLocal, anchor),
      other: sideSlotFor(group.other, withOther, anchor),
    })
  )

const sharedRows = (choice: KeyChoice): Row[] =>
  choice.between.map(pair =>
    row(choice.group.key, {
      ancestor: undefined,
      local: choice.restLocal[pair.anchor],
      other: choice.restOther[pair.side],
    })
  )

const soloRows = (choice: KeyChoice): Row[] => [
  ...unpaired(choice.restLocal.length, choice.between, 'anchor').map(index =>
    row(choice.group.key, {
      ancestor: undefined,
      local: choice.restLocal[index],
      other: undefined,
    })
  ),
  ...unpaired(choice.restOther.length, choice.between, 'side').map(index =>
    row(choice.group.key, {
      ancestor: undefined,
      local: undefined,
      other: choice.restOther[index],
    })
  ),
]

const keyRows = (group: KeySlots): Row[][] =>
  pairings(group.ancestor, group.local).flatMap(withLocal =>
    pairings(group.ancestor, group.other).flatMap(withOther => {
      const restLocal = restOf(group.local, withLocal)
      const restOther = restOf(group.other, withOther)
      return pairingsOfLongest(restLocal, restOther).map(between => {
        const choice = {
          group,
          withLocal,
          withOther,
          restLocal,
          restOther,
          between,
        }
        return [...keptRows(choice), ...sharedRows(choice), ...soloRows(choice)]
      })
    })
  )

const longestIncreasing = (sequence: readonly number[]): number => {
  const endingAt: number[] = []
  sequence.forEach((value, index) => {
    const shorter = endingAt.filter(
      (_, before) => (sequence[before] as number) < value
    )
    endingAt.push(1 + Math.max(0, ...shorter))
  })
  return Math.max(0, ...endingAt)
}

const movesOn = (rows: readonly Row[], side: LiveSide): number => {
  const kept = rows
    .filter(row => row.ancestor !== undefined && row[side] !== undefined)
    .sort(
      (left, right) =>
        (left.ancestor as Slot).pos - (right.ancestor as Slot).pos
    )
  return (
    kept.length - longestIncreasing(kept.map(row => (row[side] as Slot).pos))
  )
}

const movesOf = (rows: readonly Row[]): number =>
  movesOn(rows, 'local') + movesOn(rows, 'other')

// A value both live sides hold is lost when no entry both sides kept carries it
const dropsHeldValue = (
  rows: readonly Row[],
  held: readonly string[]
): boolean => {
  const keptByBoth = rows.filter(
    row => row.local !== undefined && row.other !== undefined
  )
  return held.some(
    token =>
      !keptByBoth.some(
        row => row.local?.token === token || row.other?.token === token
      )
  )
}

const toEntryOf = (row: Row, id: number): OrderedEntry => ({
  id,
  key: row.key,
  ...(row.ancestor && { ancestor: toEntry(row.ancestor.token) }),
  ...(row.local && { local: toEntry(row.local.token) }),
  ...(row.other && { other: toEntry(row.other.token) }),
  ancestorPos: row.ancestor?.pos ?? ABSENT_POSITION,
  localPos: row.local?.pos ?? ABSENT_POSITION,
  otherPos: row.other?.pos ?? ABSENT_POSITION,
})

const groupsOf = (
  ancestor: readonly string[],
  local: readonly string[],
  other: readonly string[]
): KeySlots[] =>
  [...new Set([...ancestor, ...local, ...other].map(keyOfToken))].map(key => ({
    key,
    ancestor: slotsOfKey(ancestor, key),
    local: slotsOfKey(local, key),
    other: slotsOfKey(other, key),
  }))

export const oracleReadings = (
  ancestor: readonly string[],
  local: readonly string[],
  other: readonly string[]
): readonly Reading[] => {
  const all = combine(groupsOf(ancestor, local, other).map(keyRows))
  const held = [...new Set(local.filter(token => other.includes(token)))]
  const keptTogether = all.filter(rows => !dropsHeldValue(rows, held))
  const pool = keptTogether.length > 0 ? keptTogether : all
  const fewest = Math.min(...pool.map(movesOf))
  return pool
    .filter(rows => movesOf(rows) === fewest)
    .map(rows => rows.map(toEntryOf))
}

const tripleOf = (entry: OrderedEntry): string =>
  `${entry.ancestorPos},${entry.localPos},${entry.otherPos}`

const readingSignature = (reading: Reading): string =>
  reading.map(tripleOf).sort().join(';')

// Ids and entry order are bookkeeping; the readings are the pairings
export const readingSignatures = (readings: readonly Reading[]): string[] =>
  readings.map(readingSignature).sort()
