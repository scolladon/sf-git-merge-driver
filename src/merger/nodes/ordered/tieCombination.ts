import type { JsonArray } from '../../../types/jsonTypes.js'
import { type MergeResult, withConflict } from '../../../types/mergeResult.js'
import { leastOf } from '../../../utils/arrayUtils.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../../ConflictMarkerBuilder.js'
import type { MergedReading } from './mergeReading.js'
import type { Wrapped, WrapSides } from './orderedSides.js'

const itemsAgree = (
  sides: readonly JsonArray[],
  indexIn: (side: JsonArray) => number
): boolean => {
  const [first] = sides as [JsonArray]
  const reference = first[indexIn(first)]
  return sides.every(side => jsonIdentical(side[indexIn(side)], reference))
}

/**
 * Terminates because the outputs differ: sides cannot all end together while
 * agreeing on every item.
 */
const sharedHead = (sides: readonly JsonArray[]): number => {
  let length = 0
  while (itemsAgree(sides, () => length)) length++
  return length
}

const sharedTail = (sides: readonly JsonArray[], head: number): number => {
  const room = leastOf(sides.map(side => side.length)) - head
  let length = 0
  const fromEnd = (side: JsonArray) => side.length - length - 1
  while (length < room && itemsAgree(sides, fromEnd)) length++
  return length
}

const middle = (side: JsonArray, head: number, tail: number): JsonArray =>
  side.slice(head, side.length - tail)

const startsAndEndsWith = (
  ancestor: JsonArray,
  head: JsonArray,
  tail: JsonArray
): boolean =>
  head.every((item, index) => jsonIdentical(ancestor[index], item)) &&
  tail.every((item, index) =>
    jsonIdentical(ancestor[ancestor.length - tail.length + index], item)
  )

export const trimmedBlock = (
  wrapped: Wrapped,
  outputs: readonly JsonArray[]
): MergeResult => {
  const sides = [...outputs, wrapped.local, wrapped.other]
  const head = sharedHead(sides)
  const tail = sharedTail(sides, head)
  const first = outputs[0] as JsonArray
  const headItems = first.slice(0, head)
  const tailItems = first.slice(first.length - tail)
  const base = startsAndEndsWith(wrapped.ancestor, headItems, tailItems)
    ? middle(wrapped.ancestor, head, tail)
    : wrapped.ancestor
  const block = buildConflictMarkers(
    middle(wrapped.local, head, tail),
    base,
    middle(wrapped.other, head, tail)
  )
  return withConflict([...headItems, block, ...tailItems])
}

export const asResult = ({
  output,
  hasConflict,
}: MergeResult): MergeResult => ({
  output,
  hasConflict,
})

/**
 * The positions of the readings with the fewest swaps of interchangeable
 * copies.
 */
export const fewestSwapIndices = (
  merged: readonly MergedReading[]
): readonly number[] => {
  const swaps = merged.map(reading => reading.phantomSwaps())
  const least = leastOf(swaps)
  return swaps.flatMap((count, at) => (count === least ? [at] : []))
}

// Among the readings, only those with the fewest swaps of interchangeable
// copies count: the others fabricate a disagreement.
export const fewestPhantomSwaps = (
  merged: readonly MergedReading[]
): readonly MergeResult[] => {
  // A lone reading is its own minimum: its swaps are never measured
  if (merged.length === 1) return merged.map(asResult)
  return fewestSwapIndices(merged).map(at => asResult(merged[at]))
}

// Readings compete from two on: a lone reading is never measured, as
// fewestPhantomSwaps leaves it.
const FEWEST_COMPETING_READINGS = 2

// No reading has fewer than zero swaps: once one has none, the readings with
// none are exactly those fewestPhantomSwaps keeps, whatever comes later.
export class TieScan {
  // The first reading, kept whole until a second one makes the swaps count
  private lone: MergedReading | undefined
  private count = 0
  private least = Number.POSITIVE_INFINITY
  private fewest: MergeResult[] = []
  private first: JsonArray | undefined
  private differs = false
  private conflicts = false

  add(reading: MergedReading): void {
    this.count++
    if (this.count < FEWEST_COMPETING_READINGS) {
      this.lone = reading
      return
    }
    // The second reading brings the first along
    if (this.lone !== undefined) this.measure(this.lone)
    this.lone = undefined
    this.measure(reading)
  }

  // combineReadings would build the block of the whole array, which reads the
  // sides only.
  isWholeConflict(): boolean {
    return this.differs && this.conflicts
  }

  // The readings fewestPhantomSwaps would keep of all those added, in order
  results(): readonly MergeResult[] {
    return this.lone === undefined ? this.fewest : [asResult(this.lone)]
  }

  private measure(reading: MergedReading): void {
    const swaps = reading.phantomSwaps()
    if (swaps < this.least) {
      this.least = swaps
      this.fewest = []
    }
    if (swaps === this.least) this.fewest.push(asResult(reading))
    if (swaps === 0) this.see(reading)
  }

  private see(reading: MergeResult): void {
    this.conflicts ||= reading.hasConflict
    if (this.first === undefined) this.first = reading.output
    else this.differs ||= !jsonIdentical(reading.output, this.first)
  }
}

export const wholeConflict = (wrapped: Wrapped): MergeResult =>
  withConflict([
    buildConflictMarkers(wrapped.local, wrapped.ancestor, wrapped.other),
  ])

export const combineReadings = (
  wrap: WrapSides,
  results: readonly MergeResult[]
): MergeResult => {
  const [first] = results as [MergeResult]
  if (results.every(result => jsonIdentical(result.output, first.output)))
    return first
  const wrapped = wrap()
  if (results.some(result => result.hasConflict)) return wholeConflict(wrapped)
  return trimmedBlock(
    wrapped,
    results.map(result => result.output)
  )
}
