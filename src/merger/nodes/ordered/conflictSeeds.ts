export type Join = readonly [number, number]

export interface ConflictMarks {
  readonly joins: readonly Join[]
  readonly seeds: readonly number[]
}

export const NO_MARKS: ConflictMarks = { joins: [], seeds: [] }

/** Joins every id of one list with every id of the other, in linear time. */
export const completeJoin = (
  first: readonly number[],
  second: readonly number[]
): readonly Join[] => {
  if (first.length === 0 || second.length === 0) return []
  const hub = first[0] as number
  const anchor = second[0] as number
  return [
    ...second.map((id): Join => [hub, id]),
    ...first.slice(1).map((id): Join => [id, anchor]),
  ]
}

export class UnionFind {
  private readonly parent: Int32Array

  constructor(size: number) {
    this.parent = Int32Array.from({ length: size }, (_, id) => id)
  }

  find(id: number): number {
    let current = id
    while (this.parent[current] !== current) {
      this.parent[current] = this.parent[
        this.parent[current] as number
      ] as number
      current = this.parent[current] as number
    }
    return current
  }

  union(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b)
  }
}

const MARKED = 1

/**
 * Equivalence classes over entry ids, some ids flagged. A byte per id beats a
 * Set on the hot path: the flags are read for every entry of the output.
 */
export class MarkedClasses {
  private readonly classes: UnionFind
  private readonly flags: Uint8Array

  constructor(readonly size: number) {
    this.classes = new UnionFind(size)
    this.flags = new Uint8Array(size)
  }

  mark(id: number): void {
    this.flags[id] = MARKED
  }

  isMarked(id: number): boolean {
    return this.flags[id] === MARKED
  }

  hasMarked(): boolean {
    return this.flags.includes(MARKED)
  }

  union(a: number, b: number): void {
    this.classes.union(a, b)
  }

  root(id: number): number {
    return this.classes.find(id)
  }
}

export class ConflictSeeds {
  private readonly seeded: MarkedClasses

  constructor(size: number) {
    this.seeded = new MarkedClasses(size)
  }

  apply(marks: ConflictMarks): void {
    for (const [a, b] of marks.joins) this.join(a, b)
    for (const id of marks.seeds) this.seeded.mark(id)
  }

  join(a: number, b: number): void {
    this.seeded.union(a, b)
    this.seeded.mark(a)
    this.seeded.mark(b)
  }

  isSeeded(id: number): boolean {
    return this.seeded.isMarked(id)
  }

  hasSeeds(): boolean {
    return this.seeded.hasMarked()
  }

  root(id: number): number {
    return this.seeded.root(id)
  }
}
