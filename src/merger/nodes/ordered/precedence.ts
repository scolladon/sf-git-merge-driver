import type { ConflictMarks, Join } from './conflictSeeds.js'
import type { OrderedContext } from './orderedContext.js'
import type { LiveSide, OrderedEntry, Reading } from './orderedEntry.js'
import { positionOn } from './orderedEntry.js'

export interface Precedence {
  readonly order: Reading
  readonly rank: ReadonlyMap<number, number>
  readonly cycleGroups: readonly (readonly number[])[]
}

const flippedOn = (
  entry: OrderedEntry,
  partner: OrderedEntry,
  side: LiveSide
): boolean =>
  // Stryker disable next-line EqualityOperator: distinct entries have distinct ancestor positions, and an entry against itself gives false either way
  entry.ancestorPos < partner.ancestorPos !==
  // Stryker disable next-line EqualityOperator: distinct entries have distinct positions on a side, and an entry against itself gives false either way
  positionOn(entry, side) < positionOn(partner, side)

const flippedPartners = (
  ctx: OrderedContext,
  entry: OrderedEntry
): readonly OrderedEntry[] =>
  ctx.keptByAll.filter(
    partner =>
      flippedOn(entry, partner, 'local') !== flippedOn(entry, partner, 'other')
  )

export const orderOverlaps = (ctx: OrderedContext): ConflictMarks => {
  const joins: Join[] = []
  for (const id of ctx.moved.local) {
    if (!ctx.moved.other.has(id)) continue
    const entry = ctx.view[id] as OrderedEntry
    for (const partner of flippedPartners(ctx, entry)) {
      joins.push([id, partner.id])
    }
  }
  return { joins, seeds: [] }
}

/** Where the sides disagree, the side that flipped the pair wins it. */
const comesBefore = (entry: OrderedEntry, partner: OrderedEntry): boolean => {
  const side = flippedOn(entry, partner, 'local') ? 'local' : 'other'
  return positionOn(entry, side) < positionOn(partner, side)
}

const localRanks = (kept: Reading): ReadonlyMap<number, number> =>
  new Map(
    kept
      .slice()
      .sort((left, right) => left.localPos - right.localPos)
      .map((entry, rank) => [entry.id, rank])
  )

/** What the pair adds to the entry's score when the sides disagree on it. */
const correction = (entry: OrderedEntry, rival: OrderedEntry): number => {
  const beforeOnLocal = entry.localPos < rival.localPos
  if (comesBefore(entry, rival) === beforeOnLocal) return 0
  return beforeOnLocal ? -1 : 1
}

/** Starts from local's order and corrects the pairs other may have won. */
const scoresOf = (ctx: OrderedContext): ReadonlyMap<number, number> => {
  const kept = ctx.keptByAll
  const ranks = localRanks(kept)
  const movedByOther = kept.filter(entry => ctx.moved.other.has(entry.id))
  const scoreOf = (entry: OrderedEntry): [number, number] => {
    const rivals = ctx.moved.other.has(entry.id) ? kept : movedByOther
    const start = kept.length - 1 - (ranks.get(entry.id) as number)
    const score = rivals.reduce(
      (total, rival) => total + correction(entry, rival),
      start
    )
    return [entry.id, score]
  }
  return new Map(kept.map(scoreOf))
}

/** A prefix beating everything after it closes a strongly connected group. */
const closesGroup = (sum: number, size: number, total: number): boolean =>
  sum === (size * (size - 1)) / 2 + size * (total - size)

const cutGroups = (
  order: Reading,
  scores: ReadonlyMap<number, number>
): readonly (readonly number[])[] => {
  const groups: number[][] = []
  let sum = 0
  let start = 0
  order.forEach((entry, index) => {
    sum += scores.get(entry.id) as number
    if (!closesGroup(sum, index + 1, order.length)) return
    groups.push(order.slice(start, index + 1).map(member => member.id))
    start = index + 1
  })
  return groups.filter(group => group.length > 1)
}

export const tournament = (ctx: OrderedContext): Precedence => {
  const scores = scoresOf(ctx)
  const order = ctx.keptByAll
    .slice()
    .sort(
      (left, right) =>
        (scores.get(right.id) as number) - (scores.get(left.id) as number)
    )
  return {
    order,
    rank: new Map(order.map((entry, index) => [entry.id, index])),
    cycleGroups: cutGroups(order, scores),
  }
}

export const cycleMarks = (precedence: Precedence): ConflictMarks => {
  const joins = precedence.cycleGroups.flatMap(([first, ...rest]) =>
    rest.map((member): Join => [first as number, member])
  )
  return { joins, seeds: [] }
}
