import { pushAll } from '../../../utils/arrayUtils.js'
import { type ConflictMarks, completeJoin, type Join } from './conflictSeeds.js'
import { type EntryStatus, PRESENCE_CONFLICT } from './content.js'
import {
  isOn,
  LIVE_SIDES,
  type LiveSide,
  type OrderedEntry,
  type Reading,
} from './orderedEntry.js'
import { ancestryOf, isGone, settledStretches } from './replacement.js'

/**
 * An insertion both sides made, each in place of different ancestor entries,
 * is one entry (ADR 071, DC15) whose place is ambiguous. It conflicts only
 * when a kept entry lies between the two places.
 */
export interface Ambiguity {
  readonly statuses: readonly EntryStatus[]
  readonly marks: ConflictMarks
}

type ReplacedBy = ReadonlyMap<number, Reading>

const isInsertion = (entry: OrderedEntry): boolean =>
  // Stryker disable next-line ConditionalExpression: an entry both sides kept follows the same maximal run of gone entries on each side (the nearest side-kept ancestor is not gone, so it ends both runs), the two replaced sets are equal and disagreement() contests nothing
  entry.ancestor === undefined

/** The ancestor entries the side removed in the place of each insertion. */
const replacedOn = (
  reading: Reading,
  statuses: readonly EntryStatus[],
  side: LiveSide
): ReplacedBy => {
  const replacedBy = new Map<number, Reading>()
  for (const { inserted, replaced } of settledStretches(
    reading,
    statuses,
    side,
    isInsertion
  )) {
    for (const entry of inserted) replacedBy.set(entry.id, replaced)
  }
  return replacedBy
}

const isHeld = (entry: OrderedEntry): boolean =>
  LIVE_SIDES.some(side => isOn(entry, side))

type Survives = (earlier: Reading, later: Reading) => boolean

/**
 * The places differ in the output only if a kept entry lies between them.
 * Replaced sets that overlap leave no room between: the same place.
 */
const survivorBetween = (
  reading: Reading,
  statuses: readonly EntryStatus[]
): Survives => {
  const ancestry = ancestryOf(reading)
  return (earlier, later) => {
    const from = (earlier.at(-1) as OrderedEntry).ancestorPos
    const to = (later[0] as OrderedEntry).ancestorPos
    return ancestry.slice(from + 1, to).some(entry => !isGone(statuses, entry))
  }
}

const inAncestorOrder = (
  first: Reading,
  second: Reading
): readonly [Reading, Reading] =>
  // Stryker disable next-line EqualityOperator: equal first positions leave survivorBetween an empty slice whichever comes first, and the held ids only feed an order-free join
  (first[0] as OrderedEntry).ancestorPos <
  (second[0] as OrderedEntry).ancestorPos
    ? [first, second]
    : [second, first]

/** What the two sides replaced, when their places for the entry differ. */
const disagreement = (
  entry: OrderedEntry,
  replaced: Readonly<Record<LiveSide, ReplacedBy>>,
  survives: Survives
): Reading => {
  const mine = replaced.local.get(entry.id)
  const theirs = replaced.other.get(entry.id)
  if (mine === undefined || theirs === undefined) return []
  const [earlier, later] = inAncestorOrder(mine, theirs)
  if (!survives(earlier, later)) return []
  return [...mine, ...theirs].filter(isHeld)
}

const contestedStatuses = (
  statuses: readonly EntryStatus[],
  contested: ReadonlySet<number>
): readonly EntryStatus[] =>
  statuses.map((status, id) => (contested.has(id) ? PRESENCE_CONFLICT : status))

export const withAgreedReplacements = (
  reading: Reading,
  statuses: readonly EntryStatus[]
): Ambiguity => {
  const replaced = {
    local: replacedOn(reading, statuses, 'local'),
    other: replacedOn(reading, statuses, 'other'),
  }
  const survives = survivorBetween(reading, statuses)
  const contested = new Set<number>()
  // Stryker disable next-line ArrayDeclaration: a stray string in joins destructures into two keys ConflictSeeds.apply only stores as non-index properties of its typed arrays
  const joins: Join[] = []
  for (const entry of reading) {
    const held = disagreement(entry, replaced, survives).map(({ id }) => id)
    for (const id of held) contested.add(id)
    pushAll(joins, completeJoin([entry.id], held))
  }
  return {
    statuses: contestedStatuses(statuses, contested),
    // Stryker disable next-line ArrayDeclaration: a stray string in seeds is marked as a non-index property of a typed array, which hasMarked and isMarked never read
    marks: { joins, seeds: [] },
  }
}
