import type { JsonArray } from '../../../types/jsonTypes.js'
import { type MergeResult, withConflict } from '../../../types/mergeResult.js'
import { leastOf } from '../../../utils/arrayUtils.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../../ConflictMarkerBuilder.js'
import type { MergedReading } from './mergeReading.js'
import type { Wrapped } from './orderedSides.js'

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

/** The positions of the readings with the fewest swaps of interchangeable copies. */
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
  // Stryker disable next-line ConditionalExpression: a lone reading is its own minimum, so the filter keeps it
  if (merged.length === 1) return merged.map(asResult)
  return fewestSwapIndices(merged).map(at => asResult(merged[at]))
}

// No reading has fewer than zero swaps: once one has none, the readings with
// none are exactly those fewestPhantomSwaps keeps, whatever comes later.
export class TieScan {
  private readonly merged: MergedReading[] = []
  private first: JsonArray | undefined
  private differs = false
  private conflicts = false

  add(reading: MergedReading): void {
    this.merged.push(reading)
    // A lone reading is never measured, as fewestPhantomSwaps leaves it.
    if (this.merged.length === 2) this.see(this.merged[0])
    if (this.merged.length >= 2) this.see(reading)
  }

  // combineReadings would build the block of the whole array, which reads the
  // sides only.
  isWholeConflict(): boolean {
    return this.differs && this.conflicts
  }

  readings(): readonly MergedReading[] {
    return this.merged
  }

  private see(reading: MergedReading): void {
    if (reading.phantomSwaps() !== 0) return
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
  wrapped: Wrapped,
  results: readonly MergeResult[]
): MergeResult => {
  const [first] = results as [MergeResult]
  if (results.every(result => jsonIdentical(result.output, first.output)))
    return first
  if (results.some(result => result.hasConflict)) return wholeConflict(wrapped)
  return trimmedBlock(
    wrapped,
    results.map(result => result.output)
  )
}
