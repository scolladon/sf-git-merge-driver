import { pushAll } from '../../../utils/arrayUtils.js'
import { type ConflictMarks, completeJoin, type Join } from './conflictSeeds.js'
import type { OrderedContext } from './orderedContext.js'
import { LIVE_SIDES, type LiveSide } from './orderedEntry.js'
import type { Spine } from './placement.js'

interface Bounds {
  readonly lo: number
  readonly hi: number
}

/** Slots are numbered by the spine entry they precede; `afterSpine[rank]` follows the entry `rank`. */
interface Frame {
  readonly ctx: OrderedContext
  readonly spine: Spine
  readonly slots: Readonly<Record<LiveSide, number[][]>>
  readonly afterSpine: number[][]
  /** The one-sided entries that inherited a place, per side. */
  readonly inherited: Readonly<Record<LiveSide, number[]>>
  readonly joins: Join[]
  readonly seeds: number[]
}

const NO_RANK = -1

const emptySlots = (spine: Spine): number[][] =>
  Array.from({ length: spine.entries.length + 1 }, () => [])

/** Suffix minimum of the spine ranks: the first spine entry still ahead. */
const ranksAhead = (frame: Frame, side: LiveSide): Int32Array => {
  const { ctx, spine } = frame
  const sequence = ctx.sequence[side]
  const ahead = new Int32Array(sequence.length + 1).fill(spine.entries.length)
  for (let index = sequence.length - 1; index >= 0; index--) {
    const rank = spine.rank.get((sequence[index] as { id: number }).id)
    const following = ahead[index + 1] as number
    ahead[index] = Math.min(following, rank ?? following)
  }
  return ahead
}

/** The merged order of the shared entries contradicts the inherited one (ADR 058). */
const placeContradicted = (frame: Frame, id: number, bounds: Bounds): void => {
  frame.seeds.push(id)
  for (let rank = bounds.hi; rank <= bounds.lo; rank++) {
    frame.joins.push([id, (frame.spine.entries[rank] as { id: number }).id])
  }
  ;(frame.afterSpine[bounds.lo] as number[]).push(id)
}

const place = (
  frame: Frame,
  side: LiveSide,
  id: number,
  bounds: Bounds
): void => {
  // Stryker disable next-line EqualityOperator: lo and hi are ranks of two distinct entries of the side (or the -1 and length sentinels), so never equal
  if (bounds.lo >= bounds.hi) return placeContradicted(frame, id, bounds)
  ;(frame.slots[side][bounds.hi] as number[]).push(id)
}

const scanSide = (frame: Frame, side: LiveSide): void => {
  const ahead = ranksAhead(frame, side)
  let lo = NO_RANK
  for (const [index, entry] of frame.ctx.sequence[side].entries()) {
    const rank = frame.spine.rank.get(entry.id)
    if (rank !== undefined) {
      lo = Math.max(lo, rank)
      continue
    }
    if (frame.ctx.place.has(entry.id)) frame.inherited[side].push(entry.id)
    place(frame, side, entry.id, { lo, hi: ahead[index] as number })
  }
}

const withoutPlace = (frame: Frame, ids: readonly number[]): number[] =>
  ids.filter(id => !frame.ctx.place.has(id))

/**
 * Both sides inserting at one position: nothing says who comes first, unless
 * both inherited a place, which orders them.
 */
const joinSharedSlots = (frame: Frame): void => {
  frame.slots.local.forEach((local, slot) => {
    const other = frame.slots.other[slot] as number[]
    pushAll(
      frame.joins,
      completeJoin(withoutPlace(frame, local), other),
      completeJoin(local, withoutPlace(frame, other))
    )
  })
}

/** An entry of the other side comes first when both inherited a place and its own is earlier. */
const precedes = (frame: Frame, theirs: number, mine: number): boolean => {
  const { place } = frame.ctx
  const theirPlace = place.get(theirs) ?? Number.POSITIVE_INFINITY
  const myPlace = place.get(mine) ?? Number.NEGATIVE_INFINITY
  // Stryker disable next-line EqualityOperator: places of non-contested runs of different sides are distinct: a place is the first replaced position plus a fraction below one, and overlapping replaced stretches are contested
  return theirPlace < myPlace
}

/**
 * Both sides inserting here: each side keeps its written order and the
 * inherited places order the entries across sides. Where one of two entries
 * has no place nothing orders them: they are joined, local first.
 */
const slotOrder = (
  frame: Frame,
  local: readonly number[],
  other: readonly number[]
): readonly number[] => {
  const merged: number[] = []
  let mine = 0
  let theirs = 0
  // Stryker disable next-line ConditionalExpression,EqualityOperator: an exhausted other side reads an entry with no place (+Infinity), which never precedes, so local is taken as the tail append does
  while (mine < local.length && theirs < other.length) {
    const takeTheirs = precedes(
      frame,
      other[theirs] as number,
      local[mine] as number
    )
    merged.push((takeTheirs ? other[theirs++] : local[mine++]) as number)
  }
  pushAll(merged, local.slice(mine), other.slice(theirs))
  return merged
}

const assemble = (frame: Frame): readonly number[] => {
  const output: number[] = []
  const { local, other } = frame.slots
  const slotAt = (slot: number): readonly number[] =>
    slotOrder(frame, local[slot] as number[], other[slot] as number[])
  frame.spine.entries.forEach((entry, rank) => {
    pushAll(
      output,
      slotAt(rank),
      [entry.id],
      frame.afterSpine[rank] as number[]
    )
  })
  pushAll(output, slotAt(frame.spine.entries.length))
  return output
}

/**
 * Two replacements of different sides that the assembled order puts against
 * the ancestor places they inherited cannot both stand: a cycle.
 */
const joinMisplaced = (frame: Frame, output: readonly number[]): void => {
  const { place } = frame.ctx
  const at = new Map(output.map((id, index) => [id, index]))
  for (const mine of frame.inherited.local) {
    for (const theirs of frame.inherited.other) {
      const byPlace =
        // Stryker disable next-line EqualityOperator: places of inherited entries of different sides are distinct, see precedes
        (place.get(mine) as number) < (place.get(theirs) as number)
      // Stryker disable next-line EqualityOperator: distinct entries have distinct output indexes
      const byOutput = (at.get(mine) as number) < (at.get(theirs) as number)
      if (byPlace !== byOutput) frame.joins.push([mine, theirs])
    }
  }
}

/**
 * Pairs of one-sided entries need no test of their own. Two entries of one
 * side keep their written order because `lo` and `hi` only grow along a side.
 * Two entries of different sides with different `lo` are ordered by the spine
 * entry of the larger `lo`, two contradicted ones with the same `lo` are both
 * joined with that spine entry, and the slot join covers the remaining pairs.
 */
export const placeOneSided = (
  ctx: OrderedContext,
  spine: Spine
): { readonly output: readonly number[]; readonly marks: ConflictMarks } => {
  const frame: Frame = {
    ctx,
    spine,
    slots: { local: emptySlots(spine), other: emptySlots(spine) },
    afterSpine: emptySlots(spine),
    // Stryker disable next-line ArrayDeclaration: a stray string has no place and no output index: both comparisons are false, so no join
    inherited: { local: [], other: [] },
    joins: [],
    seeds: [],
  }
  for (const side of LIVE_SIDES) scanSide(frame, side)
  joinSharedSlots(frame)
  const output = assemble(frame)
  joinMisplaced(frame, output)
  return {
    output,
    marks: { joins: frame.joins, seeds: frame.seeds },
  }
}
