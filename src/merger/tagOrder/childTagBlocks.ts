import { ABSENT, positionsOf } from './tagPositions.js'

const NO_FIRST = 0x7fffffff

// The tags one side writes, in order. Two neighbours are joined once and for
// all, so crossing a run costs what it newly covers.
class Axis {
  readonly at: number[]
  private readonly open: number[]

  constructor(
    private readonly sequence: readonly number[],
    tagCount: number
  ) {
    this.at = positionsOf(sequence, tagCount)
    this.open = Array.from(
      { length: Math.max(sequence.length, 1) },
      (_, position) => position
    )
  }

  // Calls `visit` on every pair of neighbours between two positions that is
  // not joined yet, and marks it joined.
  visitOpenPairs(
    from: number,
    to: number,
    visit: (left: number, right: number) => void
  ): void {
    for (
      let pair = this.nextOpen(from);
      pair < to;
      pair = this.nextOpen(pair)
    ) {
      this.open[pair] = pair + 1
      visit(this.sequence[pair], this.sequence[pair + 1])
    }
  }

  // The last slot is never joined, so the search always ends
  private nextOpen(from: number): number {
    let pair = from
    while (this.open[pair] !== pair) pair = this.open[pair]
    let step = from
    while (this.open[step] !== pair) {
      const next = this.open[step]
      this.open[step] = pair
      step = next
    }
    return pair
  }
}

// Groups of child tags to contest together, grown to a fixed point: a group
// is one contiguous run on every axis (so resolving it to a side gives that
// side's tags verbatim), and joining a group never closes a cycle with what
// stands around it. A group keeps the first and last position of its tags on
// each axis, and joins the pairs inside that span, which pulls in every tag
// written there. An axis may stand for an order of the tags themselves. Every
// group holds a tag each axis writes, so its span always exists.
export class ChildTagBlocks {
  private readonly axes: Axis[]
  private readonly parent: number[]
  private readonly weight: number[]
  private readonly first: number[][]
  private readonly last: number[][]
  // Stryker disable next-line ArrayDeclaration: the junk entry is popped last and has no span (undefined positions), so closeSpan visits nothing
  private readonly pending: number[] = []

  constructor(tagCount: number, sequences: readonly (readonly number[])[]) {
    this.axes = sequences.map(sequence => new Axis(sequence, tagCount))
    this.parent = Array.from({ length: tagCount }, (_, tag) => tag)
    // Stryker disable next-line ArrayDeclaration: weights only choose the root of a union: spans merge symmetrically and representatives() names the smallest tag of a group
    this.weight = new Array<number>(tagCount).fill(1)
    this.first = this.axes.map(axis =>
      axis.at.map(at => (at === ABSENT ? NO_FIRST : at))
    )
    // Stryker disable next-line MethodExpression: axis.at is read only here, at construction
    this.last = this.axes.map(axis => axis.at.slice())
  }

  find(tag: number): number {
    let node = tag
    while (this.parent[node] !== node) {
      this.parent[node] = this.parent[this.parent[node]]
      node = this.parent[node]
    }
    return node
  }

  join(left: number, right: number): void {
    const roots = [this.find(left), this.find(right)]
    // Stryker disable next-line ConditionalExpression: joining a group with itself widens nothing and its re-queued closure visits no open pair
    if (roots[0] === roots[1]) return
    const [big, small] = this.heavierFirst(roots[0], roots[1])
    this.parent[small] = big
    // Stryker disable next-line AssignmentOperator: weights only choose the root of a union: spans merge symmetrically and representatives() names the smallest tag of a group
    this.weight[big] += this.weight[small]
    this.axes.forEach((_, axis) => this.widenSpan(axis, big, small))
    this.pending.push(big)
  }

  // Joins what the spans of the groups cover, until nothing is left to join
  settle(): void {
    for (let tag = this.pending.pop(); tag !== undefined; ) {
      const group = this.find(tag)
      this.axes.forEach((axis, at) => this.closeSpan(axis, at, group))
      tag = this.pending.pop()
    }
  }

  // The smallest tag of each tag's group
  representatives(): number[] {
    const smallest = new Array<number>(this.parent.length).fill(ABSENT)
    const named = new Array<number>(this.parent.length)
    for (let tag = 0; tag < named.length; tag++) {
      const group = this.find(tag)
      if (smallest[group] === ABSENT) smallest[group] = tag
      named[tag] = smallest[group]
    }
    return named
  }

  private heavierFirst(left: number, right: number): [number, number] {
    // Stryker disable next-line ConditionalExpression,EqualityOperator: weights only choose the root of a union: spans merge symmetrically and representatives() names the smallest tag of a group
    return this.weight[left] >= this.weight[right]
      ? [left, right]
      : [right, left]
  }

  private widenSpan(axis: number, into: number, from: number): void {
    this.first[axis][into] = Math.min(
      this.first[axis][into],
      this.first[axis][from]
    )
    this.last[axis][into] = Math.max(
      this.last[axis][into],
      this.last[axis][from]
    )
  }

  private closeSpan(axis: Axis, at: number, group: number): void {
    axis.visitOpenPairs(this.first[at][group], this.last[at][group], (l, r) =>
      this.join(l, r)
    )
  }
}
