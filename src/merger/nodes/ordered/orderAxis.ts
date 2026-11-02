import {
  isOn,
  type LiveSide,
  type OrderedEntry,
  positionOn,
  type Reading,
} from './orderedEntry.js'

const firstTailNotBelow = (tails: readonly number[], value: number): number => {
  let low = 0
  let high = tails.length
  while (low < high) {
    const middle = (low + high) >> 1
    // Stryker disable next-line EqualityOperator: positions of one side are distinct, no tail equals the value
    if ((tails[middle] as number) < value) low = middle + 1
    else high = middle
  }
  return low
}

/** Length of the longest increasing run ending at each index, and the overall maximum. */
const runsEndingAt = (
  sequence: readonly number[]
): { readonly ends: Int32Array; readonly length: number } => {
  const tails: number[] = []
  const ends = new Int32Array(sequence.length)
  sequence.forEach((value, index) => {
    const slot = firstTailNotBelow(tails, value)
    tails[slot] = value
    ends[index] = slot + 1
  })
  return { ends, length: tails.length }
}

export const lisLength = (sequence: readonly number[]): number =>
  runsEndingAt(sequence).length

const runsStartingAt = (sequence: readonly number[]): Int32Array => {
  const reversed = sequence.map(value => -value).reverse()
  return runsEndingAt(reversed).ends.reverse()
}

/** Longest runs of one slot hold a single element only when every longest run crosses it. */
export const notInEveryLis = (
  sequence: readonly number[]
): readonly boolean[] => {
  const { ends, length } = runsEndingAt(sequence)
  const starts = runsStartingAt(sequence)
  const inSome = sequence.map(
    (_, index) =>
      (ends[index] as number) + (starts[index] as number) - 1 === length
  )
  const inSomeAtSlot = new Int32Array(length + 1)
  inSome.forEach((flag, index) => {
    if (flag) inSomeAtSlot[ends[index] as number]++
  })
  return inSome.map(
    (flag, index) => !flag || inSomeAtSlot[ends[index] as number] !== 1
  )
}

export const isKeptByAll = (entry: OrderedEntry): boolean =>
  entry.ancestor !== undefined &&
  entry.local !== undefined &&
  entry.other !== undefined

export const everyEntry = (_entry: OrderedEntry): boolean => true

export const possiblyMoved = (
  entries: Reading,
  side: LiveSide,
  universe: (entry: OrderedEntry) => boolean
): ReadonlySet<number> => {
  const kept = entries
    .filter(
      entry =>
        entry.ancestor !== undefined && isOn(entry, side) && universe(entry)
    )
    .sort((left, right) => left.ancestorPos - right.ancestorPos)
  const flags = notInEveryLis(kept.map(entry => positionOn(entry, side)))
  return new Set(kept.filter((_, index) => flags[index]).map(e => e.id))
}
