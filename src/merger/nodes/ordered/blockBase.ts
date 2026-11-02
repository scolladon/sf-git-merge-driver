import type { OrderedContext } from './orderedContext.js'
import type { OrderedEntry } from './orderedEntry.js'

const NO_ENTRY = -1
const NO_PLACE = -1

/** Where each entry landed in the rendered sequence, and which places are blocks. */
export interface Layout {
  readonly size: number
  readonly blockOf: ReadonlyMap<number, number>
  readonly inlineAt: ReadonlyMap<number, number>
  readonly blockPlaces: ReadonlySet<number>
}

interface Deletion {
  readonly previous: number
  readonly next: number
}

const isGone = (ctx: OrderedContext, entry: OrderedEntry): boolean =>
  (ctx.statuses[entry.id] as { kind: string }).kind === 'gone'

/** For each ancestor entry, the nearest live entry before and after it. */
const liveNeighbours = (
  ctx: OrderedContext,
  ancestry: readonly OrderedEntry[],
  order: Iterable<number>
): Int32Array => {
  const nearest = new Int32Array(ancestry.length)
  let last = NO_ENTRY
  for (const index of order) {
    nearest[index] = last
    const entry = ancestry[index] as OrderedEntry
    if (!isGone(ctx, entry)) last = entry.id
  }
  return nearest
}

const deletionsOf = (ctx: OrderedContext): ReadonlyMap<number, Deletion> => {
  const ancestry = ctx.entries
    .filter(entry => entry.ancestor !== undefined)
    .sort((left, right) => left.ancestorPos - right.ancestorPos)
  const indexes = Array.from(ancestry.keys())
  const previous = liveNeighbours(ctx, ancestry, indexes)
  const next = liveNeighbours(ctx, ancestry, indexes.reverse())
  const deletions = new Map<number, Deletion>()
  for (const [index, entry] of ancestry.entries()) {
    if (!isGone(ctx, entry)) continue
    deletions.set(entry.id, {
      previous: previous[index] as number,
      next: next[index] as number,
    })
  }
  return deletions
}

/** First block place at or after each place; `size` when there is none. */
const nextBlocks = (layout: Layout): Int32Array => {
  const next = new Int32Array(layout.size + 2).fill(layout.size)
  for (let place = layout.size - 1; place >= 0; place--) {
    next[place] = layout.blockPlaces.has(place)
      ? place
      : (next[place + 1] as number)
  }
  return next
}

/** First block strictly between two places, whichever comes first. */
const blockBetween = (
  layout: Layout,
  nextBlock: Int32Array,
  { previous, next }: Deletion
): number | undefined => {
  const start = layout.inlineAt.get(previous) ?? NO_PLACE
  const end = layout.inlineAt.get(next) ?? layout.size
  const place = nextBlock[Math.min(start, end) + 1] as number
  return place < Math.max(start, end) ? place : undefined
}

const regionOf = (
  layout: Layout,
  nextBlock: Int32Array,
  deletion: Deletion
): number | undefined =>
  layout.blockOf.get(deletion.previous) ??
  layout.blockOf.get(deletion.next) ??
  blockBetween(layout, nextBlock, deletion)

/**
 * A base entry deleted by both sides is shown with the block closest to where
 * it stood (ADR 060); without a block nearby it has no region to appear in.
 */
export const attachDeletions = (
  ctx: OrderedContext,
  layout: Layout
): ReadonlyMap<number, readonly number[]> => {
  const attached = new Map<number, number[]>()
  const nextBlock = nextBlocks(layout)
  for (const [id, deletion] of deletionsOf(ctx)) {
    const place = regionOf(layout, nextBlock, deletion)
    if (place === undefined) continue
    const held = attached.get(place) ?? []
    held.push(id)
    attached.set(place, held)
  }
  return attached
}
