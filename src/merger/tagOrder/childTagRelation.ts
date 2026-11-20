import { belowOnAll, belowOnBoth } from './dominance.js'
import { ABSENT } from './tagPositions.js'

// Where each tag both live sides carry stands in the ancestor (ABSENT when it
// does not carry it), local and other.
export interface SharedPositions {
  readonly ancestor: readonly number[]
  readonly local: readonly number[]
  readonly other: readonly number[]
}

// How many tags settle before / after each tag: a tag settles before another
// when the sides leave no order that puts it after.
export interface Standing {
  readonly before: number[]
  readonly after: number[]
}

// Below this many shared tags, counting pair by pair is cheaper than the
// bookkeeping of the sweeps. Measured on the element-sized merges of a Profile.
const SWEEP_FROM = 64

// The relation the sides leave over the tags both carry (ADR 073):
// - tags the sides agree on keep that order;
// - where they disagree, the side that inverted the ancestor wins;
// - a pair the ancestor does not hold whole is contested both ways, which
//   settles neither tag before the other.

const CONTESTED = -1

// The tag of the pair that comes first, or CONTESTED when the sides leave it
// open
const firstOf = (
  tag: number,
  next: number,
  { ancestor, local, other }: SharedPositions
): number => {
  // Stryker disable next-line EqualityOperator: positions of the shared tags are distinct on each side
  const localKeeps = local[next] > local[tag]
  // Stryker disable next-line EqualityOperator: positions of the shared tags are distinct on each side
  if (localKeeps === other[next] > other[tag]) return localKeeps ? tag : next
  if (ancestor[tag] === ABSENT || ancestor[next] === ABSENT) return CONTESTED
  // Stryker disable next-line EqualityOperator: ancestor positions of the tags present are distinct, absent ones return CONTESTED above
  return ancestor[next] < ancestor[tag] ? tag : next
}

// Counts each pair once, from its first tag. Time is quadratic in the shared
// tags.
export const pairStanding = (positions: SharedPositions): Standing => {
  const size = positions.local.length
  const before = new Array<number>(size).fill(0)
  const after = new Array<number>(size).fill(0)
  // Stryker disable next-line EqualityOperator: a tag at size leaves the inner loop empty
  for (let tag = 0; tag < size; tag++) {
    for (let next = tag + 1; next < size; next++) {
      const first = firstOf(tag, next, positions)
      if (first === CONTESTED) continue
      after[first]++
      before[first === tag ? next : tag]++
    }
  }
  return { before, after }
}

const negated = (values: ArrayLike<number>): Int32Array =>
  Int32Array.from(values, value => -value)

// The pairs the sides agree on: a tag is below another on both sides.
const agreedStanding = (
  local: ArrayLike<number>,
  other: ArrayLike<number>
): Standing => ({
  before: Array.from(belowOnBoth(local, other)),
  after: Array.from(belowOnBoth(negated(local), negated(other))),
})

// Among the tags the ancestor carries, in its order: tag `i` settles after
// every tag before it in the ancestor that neither side moved behind it, and
// before every tag after it that a side did not move ahead of it.
const tournamentStanding = (
  local: ArrayLike<number>,
  other: ArrayLike<number>
): Standing => {
  const inAncestor = Int32Array.from(local, (_, rank) => rank)
  const lower = belowOnAll(inAncestor, local, other)
  const upper = belowOnAll(negated(inAncestor), negated(local), negated(other))
  const size = local.length
  return {
    before: Array.from(lower, (below, i) => below + size - 1 - i - upper[i]),
    after: Array.from(upper, (above, i) => above + i - lower[i]),
  }
}

const ancestorOrder = (ancestor: readonly number[]): number[] =>
  [...ancestor.keys()]
    .filter(tag => ancestor[tag] !== ABSENT)
    .sort((x, y) => ancestor[x] - ancestor[y])

const pick = (values: readonly number[], tags: number[]): number[] =>
  tags.map(tag => values[tag])

// The same relation in time O(n log^2 n): the agreed pairs are counted over
// all the tags, then over the ones the ancestor carries, where the tournament
// of the inversions replaces what the agreement said.
export const sweepStanding = ({
  ancestor,
  local,
  other,
}: SharedPositions): Standing => {
  const standing = agreedStanding(local, other)
  const carried = ancestorOrder(ancestor)
  const [carriedLocal, carriedOther] = [
    pick(local, carried),
    pick(other, carried),
  ]
  const agreed = agreedStanding(carriedLocal, carriedOther)
  const decided = tournamentStanding(carriedLocal, carriedOther)
  carried.forEach((tag, at) => {
    standing.before[tag] += decided.before[at] - agreed.before[at]
    standing.after[tag] += decided.after[at] - agreed.after[at]
  })
  return standing
}

// Tags in the order of how many settle before them, which lines up the
// strongly connected components of the relation one after the other: a tag of
// an earlier component has fewer of them than any tag of a later one.
const tagsByPrecedence = (before: readonly number[]): number[] =>
  // Stryker disable next-line ArithmeticOperator: tags tied on before share a component, whose inner order is not observed: it is one block or a single tag
  [...before.keys()].sort((x, y) => before[x] - before[y] || x - y)

// The first `count` tags of that order form a union of leading components when
// no pair between them and the rest can go the other way. Each tag counts the
// tags it settles before minus the tags that settle before it, so the leading
// tags add up to everything they precede in the rest, and only then.
const isLeadingUnion = (
  balance: number,
  count: number,
  total: number
): boolean => balance === count * (total - count)

// The strongly connected components of that relation, in the order they must
// come. It is complete: every pair of tags has at least one direction.
export const orderedComponents = (positions: SharedPositions): number[][] => {
  const { before, after } =
    // Stryker disable next-line ConditionalExpression,EqualityOperator: pairStanding and sweepStanding count the same standing, the sweep is the O(n log n) form
    positions.local.length < SWEEP_FROM
      ? pairStanding(positions)
      : sweepStanding(positions)
  const total = before.length
  const components: number[][] = []
  let component: number[] = []
  let balance = 0
  let seen = 0
  for (const tag of tagsByPrecedence(before)) {
    component.push(tag)
    seen++
    balance += after[tag] - before[tag]
    if (!isLeadingUnion(balance, seen, total)) continue
    components.push(component)
    component = []
  }
  return components
}
