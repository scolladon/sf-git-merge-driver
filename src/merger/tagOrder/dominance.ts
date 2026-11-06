// Counts, for every point, the points that lie below it on every coordinate.
// Each coordinate holds distinct numbers: integers in a dense range are
// ordered by counting, others by a comparator sort. Time is O(n log n) for two
// coordinates and O(n log^2 n) for three.

class Fenwick {
  private readonly tree: Int32Array

  constructor(size: number) {
    this.tree = new Int32Array(size + 1)
  }

  add(at: number, delta: number): void {
    // Stryker disable next-line EqualityOperator: a write past the end of the Int32Array is ignored
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

// Above this many slots per point, filling the counting slots can cost more
// than sorting the points. Measured on node v22 from 64 to 4000 points:
// counting wins up to 16 slots per point at every size, and loses at 64 slots
// per point from 64 to 1000 points.
const RANGE_FACTOR = 16

interface CountableRange {
  readonly least: number
  readonly span: number
}

// The range the values span when counting orders them, undefined when there is
// no value, a value is not an integer or the range is too sparse.
const countableRange = (
  values: ArrayLike<number>
): CountableRange | undefined => {
  if (values.length === 0) return undefined
  let least = values[0]
  let most = values[0]
  for (let point = 0; point < values.length; point++) {
    const value = values[point]
    if (!Number.isInteger(value)) return undefined
    if (value < least) least = value
    if (value > most) most = value
  }
  const span = most - least + 1
  return span > RANGE_FACTOR * values.length ? undefined : { least, span }
}

// Points of equal value keep their index order.
const placedByCount = (
  values: ArrayLike<number>,
  { least, span }: CountableRange
): Int32Array => {
  const start = new Int32Array(span + 1)
  for (let point = 0; point < values.length; point++) {
    start[values[point] - least + 1]++
  }
  for (let slot = 1; slot <= span; slot++) start[slot] += start[slot - 1]
  const order = new Int32Array(values.length)
  for (let point = 0; point < values.length; point++) {
    order[start[values[point] - least]++] = point
  }
  return order
}

const sortedByComparator = (values: ArrayLike<number>): Int32Array =>
  Int32Array.from({ length: values.length }, (_, point) => point).sort(
    (x, y) => values[x] - values[y]
  )

export const orderedBy = (values: ArrayLike<number>): Int32Array => {
  const range = countableRange(values)
  return range ? placedByCount(values, range) : sortedByComparator(values)
}

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
        // Stryker disable next-line EqualityOperator: each coordinate holds distinct values
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
    // Stryker disable next-line EqualityOperator: the extra step only writes the scratch slot past the range, which is never read before being rewritten
    for (let at = from; at < to; at++) {
      const takeLeft =
        right >= to ||
        (left < middle &&
          // Stryker disable next-line EqualityOperator: each coordinate holds distinct values
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
