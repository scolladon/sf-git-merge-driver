// Ready tags, the lowest number first
export class ReadyTags {
  private readonly heap: number[] = []

  get size(): number {
    return this.heap.length
  }

  add(tag: number): void {
    let at = this.heap.length
    // Stryker disable next-line CallExpression: the slot is created by the write after the sift
    this.heap.push(tag)
    // Stryker disable next-line ConditionalExpression,EqualityOperator: tags are distinct and heap[-1] is undefined, which no tag is below
    while (at > 0 && this.heap[(at - 1) >> 1] > tag) {
      this.heap[at] = this.heap[(at - 1) >> 1]
      at = (at - 1) >> 1
    }
    this.heap[at] = tag
  }

  takeLowest(): number {
    const lowest = this.heap[0]
    const last = this.heap[this.heap.length - 1]
    this.heap.length -= 1
    if (this.heap.length > 0) this.sink(last)
    return lowest
  }

  private sink(tag: number): void {
    let at = 0
    for (let child = 1; child < this.heap.length; child = 2 * at + 1) {
      if (
        // Stryker disable next-line ArithmeticOperator,ConditionalExpression,EqualityOperator: heap[child + 1] past the end is undefined, which is below no tag
        child + 1 < this.heap.length &&
        // Stryker disable next-line EqualityOperator: tags are distinct
        this.heap[child + 1] < this.heap[child]
      ) {
        child++
      }
      // Stryker disable next-line EqualityOperator: tags are distinct, and the sunk tag has left the heap
      if (this.heap[child] >= tag) break
      this.heap[at] = this.heap[child]
      at = child
    }
    this.heap[at] = tag
  }
}

interface Edges {
  readonly indegree: number[]
  readonly successors: number[][]
}

const buildEdges = (lists: number[][], size: number): Edges => {
  const indegree = new Array<number>(size).fill(0)
  // Stryker disable next-line ArrayDeclaration: a junk successor has no indegree entry: its decrement is NaN, never 0
  const successors = Array.from({ length: size }, (): number[] => [])
  for (const list of lists) {
    // Stryker disable next-line EqualityOperator: the extra step pushes undefined as a successor, whose decrement is NaN, never 0
    for (let i = 1; i < list.length; i++) {
      successors[list[i - 1]].push(list[i])
      indegree[list[i]]++
    }
  }
  return { indegree, successors }
}

// When no tag is ready (a cycle), the repair must not reach past the cycle
// into tags every side already agreed on: it picks among the unemitted tags
// no block or shared order holds, with the lowest residual indegree,
// tie-broken by rank (lowest number) via the ascending scan order. Such a tag
// always exists: the shared units alone are a chain, whose first one has
// nothing left before it.
const breakCycle = (
  emitted: boolean[],
  indegree: number[],
  isShared: boolean[]
): number => {
  let best = -1
  // Stryker disable next-line EqualityOperator: emitted[length] is undefined and indegree[length] is not below a found candidate, which always exists
  for (let i = 0; i < emitted.length; i++) {
    if (emitted[i] || isShared[i]) continue
    if (best === -1 || indegree[i] < indegree[best]) best = i
  }
  return best
}

const emittedBefore = (lists: number[][], size: number): boolean[] => {
  const emitted = new Array<boolean>(size).fill(true)
  for (const list of lists) for (const tag of list) emitted[tag] = false
  return emitted
}

// Emits the tag: the tags that only waited for it become ready
const release = (
  tag: number,
  { indegree, successors }: Edges,
  emitted: boolean[],
  ready: ReadyTags
): void => {
  emitted[tag] = true
  for (const next of successors[tag]) {
    if (--indegree[next] === 0 && !emitted[next]) ready.add(next)
  }
}

const initiallyReady = (emitted: boolean[], indegree: number[]): ReadyTags => {
  const ready = new ReadyTags()
  emitted.forEach((done, tag) => {
    if (!done && indegree[tag] === 0) ready.add(tag)
  })
  return ready
}

// Orders the tags so that each list keeps its order, the lowest number first
// among the tags that could come next. The shared units come out in their own
// order whatever the cycles among the others: that order is one more list.
// Time is O(n log n) when the lists are consistent, and O(n) more for each
// cycle left to break.
export const topologicalOrder = (
  lists: number[][],
  sharedUnits: number[],
  isShared: boolean[]
): number[] => {
  const edges = buildEdges([...lists, sharedUnits], isShared.length)
  const emitted = emittedBefore(lists, isShared.length)
  const ready = initiallyReady(emitted, edges.indegree)
  const order: number[] = []
  for (let left = emitted.filter(done => !done).length; left > 0; left--) {
    const next =
      ready.size > 0
        ? ready.takeLowest()
        : breakCycle(emitted, edges.indegree, isShared)
    order.push(next)
    release(next, edges, emitted, ready)
  }
  return order
}
