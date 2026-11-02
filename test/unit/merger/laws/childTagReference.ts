// Naive reference for the order of an element's child tags (ADR 073), at both
// levels: `referenceOrder` for a nested element, `referenceRootOrder` for the
// children of the root element. It follows the definition and nothing else: every round recomputes the
// relation, the strongly connected components and the widening from scratch,
// until the blocks stop growing. The implementation under test takes
// shortcuts; this one must stay obviously right.

export interface ReferenceOrder {
  // Tags of each block, sorted; blocks sorted by their first tag
  readonly blocks: readonly (readonly string[])[]
  // Units holding a tag both live sides carry, in merged order; a block is
  // named by its first tag
  readonly sharedOrder: readonly string[]
}

type Part = string[]

// The relation the sides leave over the tags both carry: `x` may stand before
// `y` unless the sides force `y` first. Where the sides disagree, the side
// that inverted the ancestor wins, and a pair the ancestor does not carry
// whole goes both ways.
const mayPrecede = (
  [ancestor, local, other]: readonly string[][],
  x: string,
  y: string
): boolean => {
  const inLocal = local.indexOf(x) < local.indexOf(y)
  const inOther = other.indexOf(x) < other.indexOf(y)
  if (inLocal === inOther) return inLocal
  if (!ancestor.includes(x) || !ancestor.includes(y)) return true
  return ancestor.indexOf(y) < ancestor.indexOf(x)
}

const positionsOf = (side: string[], part: Part): number[] =>
  part.map(tag => side.indexOf(tag)).filter(at => at >= 0)

const reachability = (
  size: number,
  edge: (i: number, j: number) => boolean
) => {
  const reach = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => i === j || edge(i, j))
  )
  for (let via = 0; via < size; via++) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        reach[i][j] = reach[i][j] || (reach[i][via] && reach[via][j])
      }
    }
  }
  return reach
}

const mergeParts = (parts: Part[], groupOf: (i: number) => number): Part[] => {
  const merged = new Map<number, Part>()
  parts.forEach((part, i) => {
    const group = groupOf(i)
    merged.set(group, [...(merged.get(group) ?? []), ...part])
  })
  return [...merged.values()]
}

const sameComponent = (reach: boolean[][]) => (i: number) =>
  reach[i].findIndex((_, j) => reach[i][j] && reach[j][i])

const strictlyInside = (side: string[], part: Part, tag: string): boolean => {
  const at = positionsOf(side, part)
  const position = side.indexOf(tag)
  return position > Math.min(...at) && position < Math.max(...at)
}

const swallowedBy = (
  parts: Part[],
  index: number,
  liveSides: readonly string[][]
): number =>
  parts.findIndex(
    (candidate, at) =>
      at !== index &&
      candidate.some(tag =>
        liveSides.some(side => strictlyInside(side, parts[index], tag))
      )
  )

// Every tag a live side writes between two tags of a part joins the part
const widenOnce = (parts: Part[], sides: readonly string[][]): Part[] => {
  const liveSides = sides.slice(1)
  const swallowed = parts.map((_, i) => swallowedBy(parts, i, liveSides))
  const first = swallowed.findIndex(at => at >= 0)
  if (first < 0) return parts
  return mergeParts(parts, i => (i === swallowed[first] ? first : i))
}

const widen = (parts: Part[], sides: readonly string[][]): Part[] => {
  const next = widenOnce(parts, sides)
  return next.length === parts.length ? parts : widen(next, sides)
}

const quotientReach = (
  parts: Part[],
  shared: ReadonlySet<string>,
  sides: readonly string[][]
): boolean[][] =>
  reachability(parts.length, (i, j) =>
    parts[i].some(
      x =>
        shared.has(x) &&
        parts[j].some(y => shared.has(y) && mayPrecede(sides, x, y))
    )
  )

const settle = (
  start: Part[],
  shared: ReadonlySet<string>,
  sides: readonly string[][]
): Part[] => {
  let parts = widen(start, sides)
  for (;;) {
    const reach = quotientReach(parts, shared, sides)
    const merged = widen(mergeParts(parts, sameComponent(reach)), sides)
    if (merged.length === parts.length) return merged
    parts = merged
  }
}

const sortedPart = (part: Part): Part => [...part].sort()

export const referenceOrder = (
  ancestor: string[],
  local: string[],
  other: string[]
): ReferenceOrder => {
  const sides = [ancestor, local, other]
  const tags = [...new Set(sides.flat())].sort()
  const shared = new Set(local.filter(tag => other.includes(tag)))
  const singles: Part[] = tags.map(tag => [tag])
  const parts = settle(singles, shared, sides).map(sortedPart)
  const reach = quotientReach(parts, shared, sides)
  const carrying = parts
    .map((part, i) => ({ part, i }))
    .filter(({ part }) => part.some(tag => shared.has(tag)))
  const sharedOrder = carrying
    .sort((x, y) => (reach[x.i][y.i] ? -1 : 1))
    .map(({ part }) => part[0])
  const blocks = parts
    .filter(part => part.length > 1)
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
  return { blocks, sharedOrder }
}

const LEADING_TAG = 'fullName'

// `fullName` first, then code point order
export const canonicalOrder = (tags: readonly string[]): string[] => [
  ...tags.filter(tag => tag === LEADING_TAG),
  ...tags.filter(tag => tag !== LEADING_TAG).sort(),
]

// What the reference draws into blocks, and the tags both live sides carry,
// in the order the root element writes them: each block stands in its place
// as the tags it holds in canonical order, every other unit as it stands
// (ADR 073, root level). Nested elements keep `referenceOrder` as it is.
export const referenceRootOrder = (
  ancestor: string[],
  local: string[],
  other: string[]
): string[] => {
  const { blocks, sharedOrder } = referenceOrder(ancestor, local, other)
  return sharedOrder.flatMap(unit => {
    const block = blocks.find(tags => tags[0] === unit)
    return block ? canonicalOrder(block) : [unit]
  })
}
