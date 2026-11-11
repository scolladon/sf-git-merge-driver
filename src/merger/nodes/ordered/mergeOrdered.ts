import type { MergeConfig } from '../../../types/conflictTypes.js'
import { type MergeResult, noConflict } from '../../../types/mergeResult.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { collapsibleKeys } from './collapsible.js'
import { type GroupedTies, identityTies } from './identity.js'
import { isTied } from './identityComponents.js'
import { type MergedReading, mergeReading } from './mergeReading.js'
import type { Reading } from './orderedEntry.js'
import {
  type OrderedSides,
  type Wrapped,
  wrapAll,
  wrapSides,
} from './orderedSides.js'
import { mergePartwise } from './partwise.js'
import {
  combineReadings,
  fewestPhantomSwaps,
  TieScan,
  wholeConflict,
} from './tieCombination.js'
import { tiePartsOf } from './tieParts.js'

// Raw entries, not a key lookup: a repeated key keeps every entry
const takeWholeSide = (
  sides: OrderedSides,
  attribute: string
): MergeResult | null => {
  // Stryker disable ConditionalExpression,LogicalOperator,BlockStatement: shortcut of the general path: a merge takes the changed side whole (doctrine.test.ts)
  if (jsonIdentical(sides.ancestor, sides.local)) {
    return noConflict(wrapAll(attribute, sides.other))
  }
  if (
    jsonIdentical(sides.ancestor, sides.other) ||
    jsonIdentical(sides.local, sides.other)
  ) {
    return noConflict(wrapAll(attribute, sides.local))
    // Stryker restore ConditionalExpression,LogicalOperator,BlockStatement
  }
  return null
}

// One tied part is the whole tie set: the parts split nothing.
const FEWEST_TIED_PARTS = 2

const mergeStream = (
  wrapped: Wrapped,
  readings: Iterable<Reading>,
  merge: (reading: Reading) => MergedReading
): MergeResult => {
  const scan = new TieScan()
  for (const reading of readings) {
    scan.add(merge(reading))
    if (scan.isWholeConflict()) return wholeConflict(wrapped)
  }
  return combineReadings(wrapped, fewestPhantomSwaps(scan.readings()))
}

// One merge stands for its group because the merge treats the exchanged
// copies alike. Three steps carry that and must be re-checked when they
// change: possiblyMoved and notInEveryLis give a group's dropped copies one
// flag, relations between insertions both sides agreed map copy for copy, and
// the readings of a group count equal phantom swaps.
const mergeRepresentatives = (
  wrapped: Wrapped,
  representatives: Iterable<Reading>,
  merge: (reading: Reading) => MergedReading
): MergeResult | null => {
  const merged: MergedReading[] = []
  for (const reading of representatives) {
    const result = merge(reading)
    // A conflict may come from a block that differs across the group: the
    // whole stream decides, in its own order
    if (result.hasConflict) return null
    merged.push(result)
  }
  return combineReadings(wrapped, fewestPhantomSwaps(merged))
}

interface Tied {
  readonly sides: OrderedSides
  readonly wrapped: Wrapped
  readonly ties: GroupedTies
  readonly merge: (reading: Reading) => MergedReading
}

// A group has several readings only when a tied component holds an
// interchangeable key: otherwise every reading is its own group
const holdsCollapsible = (
  ties: GroupedTies,
  collapsible: ReadonlySet<string>
): boolean =>
  ties.components.some(
    component =>
      isTied(component) &&
      component.members.some(stretch => collapsible.has(ties.keyOf(stretch)))
  )

// Without a group of several readings the stream merges them all, with its
// early exit
const mergeTied = ({ sides, wrapped, ties, merge }: Tied): MergeResult => {
  const collapsible = collapsibleKeys(sides)
  const grouped = holdsCollapsible(ties, collapsible)
    ? mergeRepresentatives(wrapped, ties.representatives(collapsible), merge)
    : null
  return grouped ?? mergeStream(wrapped, ties.readings(), merge)
}

// Two tied parts need two tied components: with fewer, the cuts are not even
// looked for.
const mergePartwiseOf = (
  { sides, wrapped, ties, merge }: Tied,
  tiedComponents: number
): MergeResult | null => {
  if (tiedComponents < FEWEST_TIED_PARTS) return null
  const parts = tiePartsOf(sides, ties)
  return parts.tied.length >= FEWEST_TIED_PARTS
    ? mergePartwise({ wrapped, ties, parts, merge })
    : null
}

const tiesOf = (sides: OrderedSides): GroupedTies =>
  identityTies(sides.ancestor, sides.local, sides.other, sides.keys)

export const mergeOrderedArrays = (
  sides: OrderedSides,
  attribute: string,
  config: MergeConfig
): MergeResult => {
  const whole = takeWholeSide(sides, attribute)
  // Stryker disable next-line ConditionalExpression: shortcut of the general path: a merge takes the changed side whole (doctrine.test.ts)
  if (whole !== null) return whole
  const wrapped = wrapSides(sides, attribute)
  const ties = tiesOf(sides)
  const merge = (reading: Reading): MergedReading =>
    mergeReading(reading, attribute, config)
  const tiedComponents = ties.components.filter(isTied).length
  // One reading: nothing to group or to split, the stream merges it once
  if (tiedComponents === 0) return mergeStream(wrapped, ties.readings(), merge)
  const tied = { sides, wrapped, ties, merge }
  return mergePartwiseOf(tied, tiedComponents) ?? mergeTied(tied)
}
