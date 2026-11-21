import type { ConflictMarks, Join } from './conflictSeeds.js'
import { UnionFind } from './conflictSeeds.js'
import type { OrderedContext } from './orderedContext.js'

const NO_POSITION = Number.NEGATIVE_INFINITY

// `member` is any node of the component that held `value` when it was pushed
interface HeapEntry {
  readonly value: number
  readonly member: number
}

class MaxHeap {
  private readonly items: HeapEntry[] = []

  push(entry: HeapEntry): void {
    this.items.push(entry)
    this.siftUp(this.items.length - 1)
  }

  /** Removes and returns every entry above `value`, highest first. */
  takeAbove(value: number): HeapEntry[] {
    const taken: HeapEntry[] = []
    while (this.items.length > 0 && this.valueAt(0) > value) {
      taken.push(this.pop())
    }
    return taken
  }

  private pop(): HeapEntry {
    const top = this.items[0] as HeapEntry
    const last = this.items.pop() as HeapEntry
    if (this.items.length === 0) return top
    this.items[0] = last
    this.siftDown(0)
    return top
  }

  private valueAt(at: number): number {
    return (this.items[at] as HeapEntry).value
  }

  private swap(first: number, second: number): void {
    const held = this.items[first] as HeapEntry
    this.items[first] = this.items[second] as HeapEntry
    this.items[second] = held
  }

  private siftUp(from: number): void {
    let at = from
    while (at > 0) {
      const parent = (at - 1) >> 1
      if (this.valueAt(parent) >= this.valueAt(at)) return
      this.swap(at, parent)
      at = parent
    }
  }

  private largestOfFamily(at: number): number {
    let largest = at
    for (const child of [2 * at + 1, 2 * at + 2]) {
      if (
        child < this.items.length &&
        this.valueAt(child) > this.valueAt(largest)
      )
        largest = child
    }
    return largest
  }

  private siftDown(from: number): void {
    let at = from
    for (let next = this.largestOfFamily(at); next !== at; ) {
      this.swap(at, next)
      at = next
      next = this.largestOfFamily(at)
    }
  }
}

interface OverlapNode {
  readonly id: number
  readonly local: number
  readonly other: number
  readonly isSource: boolean
}

/**
 * Every entry both sides kept is a node, in the order local wrote them. An
 * entry both sides moved is a source: it joins every node the sides order
 * differently. Any other joins only the sources among them.
 */
const nodesOf = (ctx: OrderedContext): readonly OverlapNode[] =>
  ctx.keptByAll
    .map(entry => ({
      id: entry.id,
      local: entry.localPos,
      other: entry.otherPos,
      isSource: ctx.moved.local.has(entry.id) && ctx.moved.other.has(entry.id),
    }))
    .sort((first, second) => first.local - second.local)

/**
 * Walks the nodes by increasing local position. A node meets the earlier
 * nodes the sides order differently, those standing after it on other, and
 * joins their components. Each component keeps the highest position on other
 * of its nodes, and of its sources, in a heap. A join leaves the entries of
 * the components it replaced in place: each still names a node of the merged
 * component whose position is above the visitor's, so taking it joins a
 * component that has to be joined anyway.
 */
class OverlapSweep {
  private readonly classes: UnionFind
  private readonly highestAny: Float64Array
  private readonly highestSource: Float64Array
  private readonly byAny = new MaxHeap()
  private readonly bySource = new MaxHeap()

  constructor(size: number) {
    this.classes = new UnionFind(size)
    this.highestAny = new Float64Array(size).fill(NO_POSITION)
    this.highestSource = new Float64Array(size).fill(NO_POSITION)
  }

  root(id: number): number {
    return this.classes.find(id)
  }

  visit(node: OverlapNode): void {
    const partners = node.isSource ? this.byAny : this.bySource
    const reached = partners.takeAbove(node.other)
    this.highestAny[node.id] = node.other
    if (node.isSource) this.highestSource[node.id] = node.other
    for (const { member } of reached) this.absorb(node.id, member)
    this.publish(this.root(node.id))
  }

  private absorb(id: number, member: number): void {
    const first = this.root(id)
    const second = this.root(member)
    const any = Math.max(
      this.highestAny[first] as number,
      this.highestAny[second] as number
    )
    const source = Math.max(
      this.highestSource[first] as number,
      this.highestSource[second] as number
    )
    this.classes.union(first, second)
    const merged = this.root(id)
    this.highestAny[merged] = any
    this.highestSource[merged] = source
  }

  private publish(root: number): void {
    const source = this.highestSource[root] as number
    this.byAny.push({ value: this.highestAny[root] as number, member: root })
    if (source > NO_POSITION)
      this.bySource.push({ value: source, member: root })
  }
}

/** One join per member towards the first member of its component. */
const starJoins = (
  nodes: readonly OverlapNode[],
  rootOf: (id: number) => number
): readonly Join[] => {
  const hubs = new Map<number, number>()
  const joins: Join[] = []
  for (const { id } of nodes) {
    const root = rootOf(id)
    const hub = hubs.get(root)
    if (hub === undefined) hubs.set(root, id)
    else joins.push([hub, id])
  }
  return joins
}

/**
 * The components of the pairs `pairOverlaps` joins, without listing the
 * pairs. Joining a component by a star marks the same entries and induces the
 * same classes.
 */
export const componentOverlaps = (ctx: OrderedContext): ConflictMarks => {
  const nodes = nodesOf(ctx)
  const sweep = new OverlapSweep(ctx.view.length)
  for (const node of nodes) sweep.visit(node)
  return { joins: starJoins(nodes, id => sweep.root(id)), seeds: [] }
}
