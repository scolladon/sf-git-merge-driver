// The dominance counts with points ordered by a comparator sort, kept as the
// reference the counting placement is checked against.
import type {
  SharedPositions,
  Standing,
} from '../../../src/merger/tagOrder/childTagRelation.js'
import { ABSENT } from '../../../src/merger/tagOrder/tagPositions.js'

class Fenwick {
  private readonly tree: Int32Array

  constructor(size: number) {
    this.tree = new Int32Array(size + 1)
  }

  add(at: number, delta: number): void {
    for (let node = at + 1; node < this.tree.length; node += node & -node) {
      this.tree[node] += delta
    }
  }

  // How many were added strictly below `at`
  countBelow(at: number): number {
    let sum = 0
    for (let node = at; node > 0; node -= node & -node) sum += this.tree[node]
    return sum
  }
}

export const orderedBy = (values: ArrayLike<number>): Int32Array =>
  Int32Array.from({ length: values.length }, (_, point) => point).sort(
    (x, y) => values[x] - values[y]
  )

const ranksOf = (values: ArrayLike<number>): Int32Array => {
  const ranks = new Int32Array(values.length)
  orderedBy(values).forEach((point, rank) => {
    ranks[point] = rank
  })
  return ranks
}

export const belowOnBoth = (
  first: ArrayLike<number>,
  second: ArrayLike<number>
): Int32Array => {
  const ranks = ranksOf(second)
  const tree = new Fenwick(ranks.length)
  const counts = new Int32Array(ranks.length)
  for (const point of orderedBy(first)) {
    counts[point] = tree.countBelow(ranks[point])
    tree.add(ranks[point], 1)
  }
  return counts
}

// Divide and conquer on the first coordinate: the points of the left half are
// below those of the right half on it, so only the other two coordinates are
// left to compare across the halves.
class ThreeCoordinates {
  readonly counts: Int32Array
  private readonly order: Int32Array
  private readonly merged: Int32Array
  private readonly ranks: Int32Array
  private readonly tree: Fenwick

  constructor(
    first: ArrayLike<number>,
    private readonly second: ArrayLike<number>,
    third: ArrayLike<number>
  ) {
    this.counts = new Int32Array(first.length)
    this.order = orderedBy(first)
    this.merged = new Int32Array(first.length)
    this.ranks = ranksOf(third)
    this.tree = new Fenwick(first.length)
  }

  solve(from: number, to: number): void {
    if (to - from < 2) return
    const middle = (from + to) >> 1
    this.solve(from, middle)
    this.solve(middle, to)
    this.countAcross(from, middle, to)
    this.mergeBySecond(from, middle, to)
  }

  private countAcross(from: number, middle: number, to: number): void {
    let left = from
    for (let right = middle; right < to; right++) {
      const point = this.order[right]
      for (; left < middle; left++) {
        const lower = this.order[left]
        if (this.second[lower] > this.second[point]) break
        this.tree.add(this.ranks[lower], 1)
      }
      this.counts[point] += this.tree.countBelow(this.ranks[point])
    }
    for (let undo = from; undo < left; undo++) {
      this.tree.add(this.ranks[this.order[undo]], -1)
    }
  }

  private mergeBySecond(from: number, middle: number, to: number): void {
    let [left, right] = [from, middle]
    for (let at = from; at < to; at++) {
      const takeLeft =
        right >= to ||
        (left < middle &&
          this.second[this.order[left]] < this.second[this.order[right]])
      this.merged[at] = this.order[takeLeft ? left++ : right++]
    }
    this.order.set(this.merged.subarray(from, to), from)
  }
}

export const belowOnAll = (
  first: ArrayLike<number>,
  second: ArrayLike<number>,
  third: ArrayLike<number>
): Int32Array => {
  const sut = new ThreeCoordinates(first, second, third)
  sut.solve(0, first.length)
  return sut.counts
}

// Below this many shared tags, counting pair by pair is cheaper than the
// bookkeeping of the sweeps. Measured on the element-sized merges of a Profile.
const SWEEP_FROM = 64

// The relation the sides leave over the tags both carry:
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
  const localKeeps = local[next] > local[tag]
  if (localKeeps === other[next] > other[tag]) return localKeeps ? tag : next
  if (ancestor[tag] === ABSENT || ancestor[next] === ABSENT) return CONTESTED
  return ancestor[next] < ancestor[tag] ? tag : next
}

// Counts each pair once, from its first tag. Time is quadratic in the shared
// tags.
const pairStanding = (positions: SharedPositions): Standing => {
  const size = positions.local.length
  const before = new Array<number>(size).fill(0)
  const after = new Array<number>(size).fill(0)
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
