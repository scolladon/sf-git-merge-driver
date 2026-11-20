import { pushAll } from '../../../utils/arrayUtils.js'
import { type ConflictMarks, type Join, UnionFind } from './conflictSeeds.js'
import { isExplicitNeighbour, type OrderedContext } from './orderedContext.js'
import {
  LIVE_SIDES,
  type LiveSide,
  type OrderedEntry,
  positionOn,
  type Reading,
} from './orderedEntry.js'
import type { Precedence } from './precedence.js'

interface Range {
  readonly min: number
  readonly max: number
}

export interface Spine {
  readonly entries: Reading
  readonly rank: ReadonlyMap<number, number>
}

type Relation = 'before' | 'after' | 'disputed' | 'none'
type Reaches = (from: OrderedEntry, to: OrderedEntry) => boolean
type Related = Reaches
type Ordered = readonly [OrderedEntry, OrderedEntry]

interface WithJoins<T> {
  readonly result: T
  readonly joins: readonly Join[]
}

interface Bounds {
  readonly lo: number
  readonly hi: number
}

interface Frame {
  readonly ctx: OrderedContext
  readonly order: Reading
  readonly rank: ReadonlyMap<number, number>
  readonly cycles: UnionFind
  readonly joins: Join[]
}

const NO_LOWER_BOUND = -1

// Stryker disable EqualityOperator: entries compared are on both sides, where distinct entries have distinct positions
const isBefore = (
  first: OrderedEntry,
  second: OrderedEntry,
  side: LiveSide
): boolean => positionOn(first, side) < positionOn(second, side)
// Stryker restore EqualityOperator

/** Sides that disagree defer to the one placing the pair next to each other. */
const relate = (
  ctx: OrderedContext,
  first: OrderedEntry,
  second: OrderedEntry
): Relation => {
  const local = isBefore(first, second, 'local')
  const other = isBefore(first, second, 'other')
  if (local === other) return local ? 'before' : 'after'
  const decisive = LIVE_SIDES.filter(side =>
    isExplicitNeighbour(ctx, first, second, side)
  )
  if (decisive.length === LIVE_SIDES.length) return 'disputed'
  const [side] = decisive
  // Stryker disable next-line StringLiteral: only before, after and disputed are matched, any other label is the none relation
  if (side === undefined) return 'none'
  return isBefore(first, second, side) ? 'before' : 'after'
}

const joinInCycle = (frame: Frame, a: number, b: number): void => {
  frame.joins.push([a, b])
  frame.cycles.union(a, b)
}

const classRanges = (
  sequence: Reading,
  cycles: UnionFind
): ReadonlyMap<number, Range> => {
  const ranges = new Map<number, Range>()
  sequence.forEach((entry, rank) => {
    const root = cycles.find(entry.id)
    ranges.set(root, { min: ranges.get(root)?.min ?? rank, max: rank })
  })
  return ranges
}

const narrow = (bounds: Bounds, relation: Relation, rank: number): Bounds => {
  if (relation === 'before') return { ...bounds, lo: Math.max(bounds.lo, rank) }
  if (relation === 'after') return { ...bounds, hi: Math.min(bounds.hi, rank) }
  return bounds
}

const boundsAgainstShared = (
  frame: Frame,
  x: OrderedEntry
): WithJoins<Bounds> => {
  const joins: Join[] = []
  let bounds: Bounds = { lo: NO_LOWER_BOUND, hi: frame.order.length }
  for (const kept of frame.ctx.keptByAll) {
    const relation = relate(frame.ctx, kept, x)
    if (relation === 'disputed') joins.push([x.id, kept.id])
    bounds = narrow(bounds, relation, frame.rank.get(kept.id) as number)
  }
  return { result: bounds, joins }
}

const boundsOfAgreed = (frame: Frame): WithJoins<Map<number, Bounds>> => {
  const bounds = new Map<number, Bounds>()
  const joins: Join[] = []
  for (const x of frame.ctx.agreed) {
    const found = boundsAgainstShared(frame, x)
    bounds.set(x.id, found.result)
    pushAll(joins, found.joins)
  }
  return { result: bounds, joins }
}

const orient = (
  x: OrderedEntry,
  y: OrderedEntry,
  relation: Relation
): Ordered | undefined => {
  if (relation === 'before') return [x, y]
  return relation === 'after' ? [y, x] : undefined
}

/** Every pair is looked at once: the relations are as many as the pairs. */
const agreedRelations = (frame: Frame): WithJoins<readonly Ordered[]> => {
  const { agreed } = frame.ctx
  const relations: Ordered[] = []
  const joins: Join[] = []
  // Stryker disable next-line EqualityOperator: a first at agreed.length leaves the inner loop empty
  for (let first = 0; first < agreed.length; first++) {
    for (let second = first + 1; second < agreed.length; second++) {
      const x = agreed[first] as OrderedEntry
      const y = agreed[second] as OrderedEntry
      const relation = relate(frame.ctx, x, y)
      if (relation === 'disputed') joins.push([x.id, y.id])
      const ordered = orient(x, y, relation)
      if (ordered !== undefined) relations.push(ordered)
    }
  }
  return { result: relations, joins }
}

const tightenAlongRelations = (
  relations: readonly Ordered[],
  bounds: Map<number, Bounds>
): void => {
  for (const [x, y] of relations) {
    const first = bounds.get(x.id) as Bounds
    const second = bounds.get(y.id) as Bounds
    // Stryker disable next-line EqualityOperator: equal bounds are rewritten with the same value
    if (second.hi < first.hi) bounds.set(x.id, { ...first, hi: second.hi })
    // Stryker disable next-line EqualityOperator: equal bounds are rewritten with the same value
    if (first.lo > second.lo) bounds.set(y.id, { ...second, lo: first.lo })
  }
}

/**
 * A bound inside a cycle class stands for the whole class. The ranges predate
 * cycles closed earlier in the same pass, so a bound only ever moves outwards.
 */
const widenToClasses = (
  frame: Frame,
  bounds: Bounds,
  ranges: ReadonlyMap<number, Range>
): Bounds => {
  const rangeAt = (rank: number): Range =>
    ranges.get(
      frame.cycles.find((frame.order[rank] as OrderedEntry).id)
    ) as Range
  return {
    lo:
      bounds.lo === NO_LOWER_BOUND
        ? bounds.lo
        : Math.max(bounds.lo, rangeAt(bounds.lo).max),
    hi:
      bounds.hi === frame.order.length
        ? bounds.hi
        : Math.min(bounds.hi, rangeAt(bounds.hi).min),
  }
}

const settle = (
  frame: Frame,
  x: OrderedEntry,
  bounds: Map<number, Bounds>,
  ranges: ReadonlyMap<number, Range>,
  cyclic: Set<number>
): void => {
  const widened = widenToClasses(frame, bounds.get(x.id) as Bounds, ranges)
  bounds.set(x.id, widened)
  if (widened.lo < widened.hi || cyclic.has(x.id)) return
  cyclic.add(x.id)
  for (let rank = widened.hi; rank <= widened.lo; rank++) {
    joinInCycle(frame, x.id, (frame.order[rank] as OrderedEntry).id)
  }
}

/** Whatever changed a bound or closed a cycle calls for another pass. */
const fingerprint = (
  bounds: ReadonlyMap<number, Bounds>,
  cyclic: ReadonlySet<number>
): string => JSON.stringify([...bounds.values(), cyclic.size])

const propagateBounds = (
  frame: Frame,
  relations: readonly Ordered[],
  bounds: Map<number, Bounds>
): ReadonlySet<number> => {
  const cyclic = new Set<number>()
  let previous: string
  do {
    previous = fingerprint(bounds, cyclic)
    tightenAlongRelations(relations, bounds)
    const ranges = classRanges(frame.order, frame.cycles)
    for (const x of frame.ctx.agreed) settle(frame, x, bounds, ranges, cyclic)
  } while (previous !== fingerprint(bounds, cyclic))
  return cyclic
}

// Stryker disable next-line ArrowFunction: dominates only shortcuts throughRows: relations list every pair both sides order alike, so when all are dominated they are the dominated pairs, already transitive
const dominates: Related = (from, to) =>
  // Stryker disable next-line ConditionalExpression,StringLiteral: dominates only shortcuts throughRows: relations list every pair both sides order alike, so when all are dominated they are the dominated pairs, already transitive
  isBefore(from, to, 'local') && isBefore(from, to, 'other')

const WORD_BITS = 32

const bitRows = (size: number): Uint32Array[] =>
  Array.from(
    { length: size },
    // Stryker disable next-line ArithmeticOperator: rows need ceil(size / WORD_BITS) words, extra words stay zero
    () => new Uint32Array(Math.ceil(size / WORD_BITS))
  )

const hasBit = (row: Uint32Array, bit: number): boolean =>
  ((row[Math.floor(bit / WORD_BITS)] as number) & (1 << (bit % WORD_BITS))) !==
  0

const setBit = (row: Uint32Array, bit: number): void => {
  row[Math.floor(bit / WORD_BITS)] |= 1 << (bit % WORD_BITS)
}

const absorb = (row: Uint32Array, via: Uint32Array): void => {
  via.forEach((word, at) => {
    row[at] |= word
  })
}

const throughRows = (
  agreed: Reading,
  relations: readonly Ordered[]
): Related => {
  const at = new Map(agreed.map((x, index) => [x.id, index]))
  const rows = bitRows(agreed.length)
  for (const [x, y] of relations) {
    setBit(rows[at.get(x.id) as number] as Uint32Array, at.get(y.id) as number)
  }
  rows.forEach((via, index) =>
    rows.forEach(row => {
      if (hasBit(row, index)) absorb(row, via)
    })
  )
  return (from, to) =>
    hasBit(
      rows[at.get(from.id) as number] as Uint32Array,
      at.get(to.id) as number
    )
}

/**
 * Relations that all follow the order of both sides are the pairs one entry
 * before the other on both sides: transitive already, nothing to close.
 */
const closeRelations = (
  agreed: Reading,
  relations: readonly Ordered[]
): Related =>
  // Stryker disable next-line ArrowFunction: dominates only shortcuts throughRows: relations list every pair both sides order alike, so when all are dominated they are the dominated pairs, already transitive
  relations.every(([x, y]) => dominates(x, y))
    ? dominates
    : throughRows(agreed, relations)

interface Standing {
  readonly bounds: ReadonlyMap<number, Bounds>
  readonly related: Related
}

/** A shared entry sits at its rank: it bounds itself on both sides. */
const lowestSlot = (
  frame: Frame,
  standing: Standing,
  entry: OrderedEntry
): number =>
  frame.rank.get(entry.id) ?? (standing.bounds.get(entry.id) as Bounds).lo

const highestSlot = (
  frame: Frame,
  standing: Standing,
  entry: OrderedEntry
): number =>
  frame.rank.get(entry.id) ?? (standing.bounds.get(entry.id) as Bounds).hi

const reachesOne = (
  frame: Frame,
  standing: Standing,
  from: OrderedEntry,
  to: OrderedEntry
): boolean => {
  const bothAgreed = !frame.rank.has(from.id) && !frame.rank.has(to.id)
  if (bothAgreed && standing.related(from, to)) return true
  return highestSlot(frame, standing, from) <= lowestSlot(frame, standing, to)
}

const classMembers = (frame: Frame): ReadonlyMap<number, Reading> => {
  const members = new Map<number, OrderedEntry[]>()
  for (const entry of [...frame.ctx.keptByAll, ...frame.ctx.agreed]) {
    const root = frame.cycles.find(entry.id)
    const sameClass = members.get(root)
    if (sameClass === undefined) members.set(root, [entry])
    else sameClass.push(entry)
  }
  return members
}

/** Classes of several members are asked about often: each pair is settled once. */
const rememberedClassReach = (
  frame: Frame,
  standing: Standing,
  members: ReadonlyMap<number, Reading>
): ((fromClass: number, toClass: number) => boolean) => {
  const span = frame.ctx.entries.length
  const remembered = new Map<number, boolean>()
  return (fromClass, toClass) => {
    // Stryker disable next-line ArithmeticOperator: any injective key works and both forms are injective for classes below span
    const key = fromClass * span + toClass
    const known = remembered.get(key)
    // Stryker disable next-line ConditionalExpression: memo only: reachesOne is pure
    if (known !== undefined) return known
    const reached = (members.get(fromClass) as Reading).some(source =>
      (members.get(toClass) as Reading).some(target =>
        reachesOne(frame, standing, source, target)
      )
    )
    // Stryker disable next-line CallExpression: memo only: reachesOne is pure
    remembered.set(key, reached)
    return reached
  }
}

/** Entries on one precedence cycle reach whatever any of them reaches. */
const reachesThroughClasses = (frame: Frame, standing: Standing): Reaches => {
  const members = classMembers(frame)
  const alone = new Set(
    // Stryker disable next-line ArrayDeclaration,ArrowFunction,ConditionalExpression,EqualityOperator: alone is a shortcut: every entry asked about is in keptByAll or agreed (order is keptByAll sorted, slots hold agreed), so a singleton class holds exactly the asked entry and throughClasses asks reachesOne(from, to); the not-singleton form sends two several-member classes through reachesOne too, and none of 400k random placements (2k asking such a pair with a negative answer) told it from the class-wide answer, as widenToClasses keeps a bound outside the inside of a class
    [...members].filter(([, group]) => group.length === 1).map(([root]) => root)
  )
  const throughClasses = rememberedClassReach(frame, standing, members)
  return (from, to) => {
    const fromClass = frame.cycles.find(from.id)
    const toClass = frame.cycles.find(to.id)
    if (fromClass === toClass) return true
    // Stryker disable next-line ConditionalExpression,BlockStatement: alone is a shortcut: every entry asked about is in keptByAll or agreed (order is keptByAll sorted, slots hold agreed), so a singleton class holds exactly the asked entry and throughClasses asks reachesOne(from, to)
    if (alone.has(fromClass) && alone.has(toClass)) {
      return reachesOne(frame, standing, from, to)
    }
    return throughClasses(fromClass, toClass)
  }
}

const byLocalPosition = (left: OrderedEntry, right: OrderedEntry): number =>
  left.localPos - right.localPos

const groupBySlot = (
  agreed: Reading,
  slotOf: ReadonlyMap<number, number>
): ReadonlyMap<number, Reading> => {
  const groups = new Map<number, OrderedEntry[]>()
  for (const x of agreed.slice().sort(byLocalPosition)) {
    const slot = slotOf.get(x.id) as number
    const sameSlot = groups.get(slot)
    if (sameSlot === undefined) groups.set(slot, [x])
    else sameSlot.push(x)
  }
  return groups
}

/** `reached[from][to]` tells whether the `from`th insertion reaches the `to`th. */
interface Slot {
  readonly items: Reading
  readonly reached: readonly Uint8Array[]
}

const reachedFrom = (
  from: OrderedEntry,
  items: Reading,
  reaches: Reaches
): Uint8Array => {
  const row = new Uint8Array(items.length)
  for (let to = 0; to < items.length; to++) {
    row[to] = reaches(from, items[to] as OrderedEntry) ? 1 : 0
  }
  return row
}

const slotOfInsertions = (items: Reading, reaches: Reaches): Slot => ({
  items,
  reached: items.map(from => reachedFrom(from, items, reaches)),
})

const rowOf = (slot: Slot, at: number): Uint8Array =>
  slot.reached[at] as Uint8Array

const countReachedBy = (slot: Slot, from: number, counts: Int32Array): void => {
  const row = rowOf(slot, from)
  // Stryker disable next-line EqualityOperator: row[row.length] is undefined, never 1
  for (let to = 0; to < row.length; to++) {
    if (row[to] === 1 && rowOf(slot, to)[from] === 0) counts[to]++
  }
}

const releaseSuccessors = (
  slot: Slot,
  source: number,
  counts: Int32Array
): void => {
  const row = rowOf(slot, source)
  // Stryker disable next-line EqualityOperator: row[row.length] is undefined, never 1
  for (let to = 0; to < row.length; to++) {
    if (row[to] === 1 && rowOf(slot, to)[source] === 0) counts[to]--
  }
}

const reachersCounts = (slot: Slot): Int32Array => {
  const counts = new Int32Array(slot.items.length)
  for (let from = 0; from < counts.length; from++) {
    countReachedBy(slot, from, counts)
  }
  return counts
}

/** The first pending entry nothing else reaches; the least reached one if none. */
const nextSource = (counts: Int32Array, placed: Uint8Array): number => {
  let best = -1
  // Stryker disable next-line EqualityOperator: counts[counts.length] is undefined and placed[counts.length] is not 1, a pending entry was already found before it so the comparison is false
  for (let at = 0; at < counts.length; at++) {
    if (placed[at] === 1) continue
    if (best < 0 || (counts[at] as number) < (counts[best] as number)) best = at
  }
  return best
}

const sourcesFirst = (slot: Slot): Reading => {
  const counts = reachersCounts(slot)
  const placed = new Uint8Array(slot.items.length)
  return slot.items.map(() => {
    const source = nextSource(counts, placed)
    placed[source] = 1
    releaseSuccessors(slot, source, counts)
    return slot.items[source] as OrderedEntry
  })
}

const unorderedAfter = (slot: Slot, first: number): readonly Join[] => {
  const joins: Join[] = []
  const row = slot.reached[first] as Uint8Array
  for (let second = first + 1; second < slot.items.length; second++) {
    if (row[second] !== (slot.reached[second] as Uint8Array)[first]) continue
    joins.push([
      (slot.items[first] as OrderedEntry).id,
      (slot.items[second] as OrderedEntry).id,
    ])
  }
  return joins
}

/** Two insertions in one slot that reach each other both ways or neither way. */
const unorderedInSlot = (slots: ReadonlyMap<number, Slot>): readonly Join[] =>
  [...slots.values()].flatMap(slot =>
    slot.items.flatMap((_, first) => unorderedAfter(slot, first))
  )

const buildSpine = (frame: Frame, slots: ReadonlyMap<number, Slot>): Reading =>
  Array.from({ length: frame.order.length + 1 }, (_, at) => {
    const slot = slots.get(at)
    return [
      ...(slot === undefined ? [] : sourcesFirst(slot)),
      ...frame.order.slice(at, at + 1),
    ]
  }).flat()

const resolveContradictions = (
  frame: Frame,
  relations: readonly Ordered[],
  spine: Reading
): void => {
  const rank = new Map(spine.map((entry, index) => [entry.id, index]))
  for (const [x, y] of relations) {
    const last = rank.get(x.id) as number
    for (let at = rank.get(y.id) as number; at <= last; at++) {
      joinInCycle(frame, x.id, (spine[at] as OrderedEntry).id)
    }
  }
}

/** Asks whether `first` reaches `second` before the reverse question. */
const isReachedEitherWay = (
  first: OrderedEntry,
  second: OrderedEntry,
  reaches: Reaches
): boolean => reaches(first, second) || reaches(second, first)

const unreachedFrom = (
  x: OrderedEntry,
  spine: Reading,
  rank: ReadonlyMap<number, number>,
  reaches: Reaches
): readonly Join[] => {
  const joins: Join[] = []
  const at = rank.get(x.id) as number
  // Asking the likelier way first, by spine position, spares the other question
  spine.forEach((z, index) => {
    const reached =
      // Stryker disable next-line ConditionalExpression,EqualityOperator: isReachedEitherWay is symmetric and reaches is pure: the direction asked first changes only the work
      index < at
        ? isReachedEitherWay(z, x, reaches)
        : isReachedEitherWay(x, z, reaches)
    if (!reached) joins.push([x.id, z.id])
  })
  return joins
}

const unreachedPairs = (
  agreed: Reading,
  spine: Reading,
  reaches: Reaches
): readonly Join[] => {
  // Stryker disable next-line ArrayDeclaration: rank only picks which direction is asked first, see unreachedFrom
  const rank = new Map(spine.map((entry, index) => [entry.id, index]))
  return agreed.flatMap(x => unreachedFrom(x, spine, rank, reaches))
}

const slotOf = (
  frame: Frame,
  bounds: ReadonlyMap<number, Bounds>,
  cyclic: ReadonlySet<number>
): ReadonlyMap<number, number> =>
  new Map(
    frame.ctx.agreed.map(x => {
      const { lo, hi } = bounds.get(x.id) as Bounds
      return [x.id, cyclic.has(x.id) ? lo + 1 : hi]
    })
  )

const cyclesFrom = (ctx: OrderedContext, precedence: Precedence): UnionFind => {
  const cycles = new UnionFind(ctx.entries.length)
  for (const [first, ...rest] of precedence.cycleGroups) {
    for (const member of rest) cycles.union(first as number, member)
  }
  return cycles
}

const spineOf = (entries: Reading): Spine => ({
  entries,
  rank: new Map(entries.map((entry, index) => [entry.id, index])),
})

const makeFrame = (ctx: OrderedContext, precedence: Precedence): Frame => ({
  ctx,
  order: precedence.order,
  rank: precedence.rank,
  cycles: cyclesFrom(ctx, precedence),
  joins: [],
})

const assembleSpine = (
  frame: Frame,
  relations: readonly Ordered[],
  standing: Standing,
  grouped: ReadonlyMap<number, Reading>
): Reading => {
  const reaches = reachesThroughClasses(frame, standing)
  const slots = new Map(
    [...grouped].map(([at, items]) => [at, slotOfInsertions(items, reaches)])
  )
  const entries = buildSpine(frame, slots)
  pushAll(frame.joins, unorderedInSlot(slots))
  resolveContradictions(frame, relations, entries)
  return entries
}

export const placeAgreedInsertions = (
  ctx: OrderedContext,
  precedence: Precedence
): { readonly spine: Spine; readonly marks: ConflictMarks } => {
  const frame = makeFrame(ctx, precedence)
  const { result: bounds, joins: sharedJoins } = boundsOfAgreed(frame)
  const { result: relations, joins } = agreedRelations(frame)
  pushAll(frame.joins, sharedJoins, joins)
  const cyclic = propagateBounds(frame, relations, bounds)
  const standing = { bounds, related: closeRelations(ctx.agreed, relations) }
  const slots = groupBySlot(ctx.agreed, slotOf(frame, bounds, cyclic))
  const entries = assembleSpine(frame, relations, standing, slots)
  const reaches = reachesThroughClasses(frame, standing)
  pushAll(frame.joins, unreachedPairs(ctx.agreed, entries, reaches))
  return {
    spine: spineOf(entries),
    marks: { joins: frame.joins, seeds: [] },
  }
}
