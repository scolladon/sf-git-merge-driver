import { pushAll } from '../../../utils/arrayUtils.js'
import { attachDeletions, type Layout } from './blockBase.js'
import { BlockClosure } from './blockClosure.js'
import type { ConflictSeeds } from './conflictSeeds.js'
import type { EntryStatus } from './content.js'
import type { OrderedContext } from './orderedContext.js'
import { LIVE_SIDES, type LiveSide, type OrderedEntry } from './orderedEntry.js'

export interface OrderedBlock {
  readonly local: readonly number[]
  readonly ancestor: readonly number[]
  readonly other: readonly number[]
}

export type OrderedItem =
  | { readonly entry: number }
  | { readonly block: OrderedBlock }

type Slices = Record<LiveSide, readonly number[]>

type Placed = { readonly entry: number } | { readonly slices: Slices }

const closeBlocks = (
  ctx: OrderedContext,
  output: readonly number[],
  seeds: ConflictSeeds
): BlockClosure => {
  const closure = new BlockClosure(ctx.entries.length)
  for (const id of output) {
    if (seeds.isSeeded(id)) closure.seed(id, seeds.root(id))
  }
  closure.settle(
    output,
    LIVE_SIDES.map(side => ctx.written[side].map(entry => entry.id))
  )
  return closure
}

const slicesByRoot = (
  ctx: OrderedContext,
  closure: BlockClosure
): ReadonlyMap<number, Slices> => {
  const slices = new Map<number, Record<LiveSide, number[]>>()
  for (const side of LIVE_SIDES) {
    for (const { id } of ctx.written[side]) {
      const root = closure.root(id)
      const found = slices.get(root) ?? { local: [], other: [] }
      found[side].push(id)
      slices.set(root, found)
    }
  }
  return slices
}

interface TrimmedBlock extends Slices {
  readonly head: readonly number[]
  readonly tail: readonly number[]
}

const sharedCleanEnd = (
  ctx: OrderedContext,
  local: number,
  other: number
): boolean =>
  local === other && (ctx.statuses[local] as EntryStatus).kind === 'clean'

const headLength = (ctx: OrderedContext, { local, other }: Slices): number => {
  // Stryker disable next-line MethodExpression: past the shorter slice one side reads undefined against a defined id and the walk stops
  const room = Math.min(local.length, other.length)
  let length = 0
  while (
    // Stryker disable next-line ConditionalExpression,EqualityOperator: a block never holds two identical all-clean slices, so past the shorter list the sides read a defined id against undefined and the walk has already stopped
    length < room &&
    sharedCleanEnd(ctx, local[length] as number, other[length] as number)
  ) {
    length++
  }
  return length
}

const tailLength = (
  ctx: OrderedContext,
  { local, other }: Slices,
  head: number
): number => {
  // Stryker disable next-line ArithmeticOperator,MethodExpression: past the shorter slice one side reads undefined against a defined id and the walk stops; a block never holds two identical all-clean slices, so past the shorter list the sides read a defined id against undefined and the walk has already stopped
  const room = Math.min(local.length, other.length) - head
  const fromEnd = (ids: readonly number[], length: number): number =>
    ids[ids.length - 1 - length] as number
  let length = 0
  while (
    // Stryker disable next-line ConditionalExpression,EqualityOperator: a block never holds two identical all-clean slices, so past the shorter list the sides read a defined id against undefined and the walk has already stopped
    length < room &&
    sharedCleanEnd(ctx, fromEnd(local, length), fromEnd(other, length))
  ) {
    length++
  }
  return length
}

/** Common ends are emitted outside the markers; a conflicting entry stays inside. */
const trimEnds = (ctx: OrderedContext, slices: Slices): TrimmedBlock => {
  const head = headLength(ctx, slices)
  const tail = tailLength(ctx, slices, head)
  const inner = (ids: readonly number[]) => ids.slice(head, ids.length - tail)
  return {
    head: slices.local.slice(0, head),
    tail: slices.local.slice(slices.local.length - tail),
    local: inner(slices.local),
    other: inner(slices.other),
  }
}

const inline = (ids: readonly number[]): Placed[] =>
  ids.map(entry => ({ entry }))

const placeBlock = (
  ctx: OrderedContext,
  placed: Placed[],
  slices: Slices
): void => {
  const { head, tail, local, other } = trimEnds(ctx, slices)
  pushAll(placed, inline(head), [{ slices: { local, other } }], inline(tail))
}

const placeAll = (
  ctx: OrderedContext,
  output: readonly number[],
  closure: BlockClosure
): readonly Placed[] => {
  const slices = slicesByRoot(ctx, closure)
  const placed: Placed[] = []
  const rendered = new Set<number>()
  for (const id of output) {
    if (!closure.isMember(id)) placed.push({ entry: id })
    else if (!rendered.has(closure.root(id))) {
      rendered.add(closure.root(id))
      placeBlock(ctx, placed, slices.get(closure.root(id)) as Slices)
    }
  }
  return placed
}

const layoutOf = (placed: readonly Placed[]): Layout => {
  const blockOf = new Map<number, number>()
  const inlineAt = new Map<number, number>()
  const blockPlaces = new Set<number>()
  for (const [place, item] of placed.entries()) {
    if ('entry' in item) {
      inlineAt.set(item.entry, place)
      continue
    }
    blockPlaces.add(place)
    for (const side of LIVE_SIDES) {
      for (const id of item.slices[side]) blockOf.set(id, place)
    }
  }
  return { size: placed.length, blockOf, inlineAt, blockPlaces }
}

const baseOf = (
  ctx: OrderedContext,
  slices: Slices,
  deleted: readonly number[]
): readonly number[] => {
  const ids = new Set([...slices.local, ...slices.other])
  const entries = [...ids].map(id => ctx.entries[id] as OrderedEntry)
  const kept = entries.filter(entry => entry.ancestor !== undefined)
  const all = [...kept, ...deleted.map(id => ctx.entries[id] as OrderedEntry)]
  return all
    .sort((left, right) => left.ancestorPos - right.ancestorPos)
    .map(entry => entry.id)
}

export const buildBlocks = (
  ctx: OrderedContext,
  output: readonly number[],
  seeds: ConflictSeeds
): readonly OrderedItem[] => {
  const placed = placeAll(ctx, output, closeBlocks(ctx, output, seeds))
  const deletions = attachDeletions(ctx, layoutOf(placed))
  return placed.map((item, place) =>
    'entry' in item
      ? item
      : {
          block: {
            ...item.slices,
            ancestor: baseOf(ctx, item.slices, deletions.get(place) ?? []),
          },
        }
  )
}
