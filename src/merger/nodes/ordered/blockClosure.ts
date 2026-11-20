import { MarkedClasses } from './conflictSeeds.js'

/**
 * Grows the seeded entries into blocks: a block owns everything lying between
 * two of its members in a sequence, and blocks touching in the output merge.
 */
export class BlockClosure {
  private readonly members: MarkedClasses

  constructor(size: number) {
    this.members = new MarkedClasses(size)
  }

  seed(id: number, root: number): void {
    this.members.mark(id)
    this.members.union(id, root)
  }

  isMember(id: number): boolean {
    return this.members.isMarked(id)
  }

  root(id: number): number {
    return this.members.root(id)
  }

  settle(
    output: readonly number[],
    sides: readonly (readonly number[])[]
  ): void {
    while (this.sweep(output, sides));
  }

  private sweep(
    output: readonly number[],
    sides: readonly (readonly number[])[]
  ): boolean {
    const grew = [output, ...sides].map(sequence => this.closeSpan(sequence))
    grew.push(this.joinAdjacent(output))
    return grew.some(Boolean)
  }

  private absorb(anchor: number, id: number): boolean {
    if (this.root(anchor) === this.root(id)) return false
    this.members.mark(id)
    this.members.union(anchor, id)
    return true
  }

  /** Per position, the end (exclusive) of the block starting there or covering it. */
  private reachAt(sequence: readonly number[]): Int32Array {
    const last = new Int32Array(this.members.size)
    sequence.forEach((id, index) => {
      last[this.root(id)] = index + 1
    })
    return Int32Array.from(sequence, id => last[this.root(id)] as number)
  }

  private closeSpan(sequence: readonly number[]): boolean {
    const reach = this.reachAt(sequence)
    let grew = false
    let anchor = 0
    let stop = 0
    for (const [index, id] of sequence.entries()) {
      if (index >= stop) {
        anchor = id
        stop = reach[index] as number
        continue
      }
      grew = this.absorb(anchor, id) || grew
      stop = Math.max(stop, reach[index] as number)
    }
    return grew
  }

  private joinMembers(previous: number, id: number): boolean {
    return (
      this.isMember(previous) && this.isMember(id) && this.absorb(previous, id)
    )
  }

  private joinAdjacent(output: readonly number[]): boolean {
    return output
      .slice(1)
      .map((id, index) => this.joinMembers(output[index] as number, id))
      .some(Boolean)
  }
}
