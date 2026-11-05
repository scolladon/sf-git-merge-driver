import { UnionFind } from './conflictSeeds.js'
import { lisLength } from './orderAxis.js'
import { LIVE_SIDES, type LiveSide } from './orderedEntry.js'

/** An entry holding an ancestor copy and a copy of one live side. */
export interface Point {
  readonly ancestor: number
  readonly position: number
}

export type PointSet = Readonly<Record<LiveSide, readonly Point[]>>

type Alternatives = readonly PointSet[]

type Tuple = readonly number[]

interface Candidate extends Point {
  readonly stretch: number
  readonly alternative: number
  readonly fixed: boolean
}

// A candidate between two separators belongs to the gap they bound.
interface Placed extends Candidate {
  readonly label: number
}

const byAncestor = (left: Point, right: Point): number =>
  left.ancestor - right.ancestor

const grouped = <Item, Key>(
  items: readonly Item[],
  keyOf: (item: Item) => Key
): ReadonlyMap<Key, readonly Item[]> => {
  const groups = new Map<Key, Item[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [item])
    else group.push(item)
  }
  return groups
}

const candidatesOf = (
  alternatives: Alternatives,
  stretch: number,
  side: LiveSide
): readonly Candidate[] =>
  alternatives.flatMap((set, alternative) =>
    set[side].map(({ ancestor, position }) => ({
      ancestor,
      position,
      stretch,
      alternative,
      fixed: alternatives.length === 1,
    }))
  )

const candidatesOn = (
  stretches: readonly Alternatives[],
  side: LiveSide
): readonly Candidate[] =>
  stretches
    .flatMap((alternatives, stretch) =>
      candidatesOf(alternatives, stretch, side)
    )
    .sort(byAncestor)

// The candidates whose value beats every one before them in the sequence.
const recordHolders = (
  sequence: readonly Candidate[],
  coordinateOf: (candidate: Candidate) => number
): ReadonlySet<Candidate> => {
  const holders = new Set<Candidate>()
  let best = Number.NEGATIVE_INFINITY
  for (const candidate of sequence) {
    const value = coordinateOf(candidate)
    if (value <= best) continue
    holders.add(candidate)
    best = value
  }
  return holders
}

// A fixed point is a separator when every other candidate is below it on both
// coordinates or above it on both: the candidates sorted by ancestor then
// show it above all positions before it and below all positions after it.
const separatorTest = (
  sorted: readonly Candidate[]
): ((candidate: Candidate) => boolean) => {
  const aboveEarlier = recordHolders(sorted, ({ position }) => position)
  const belowLater = recordHolders(
    sorted.toReversed(),
    ({ position }) => -position
  )
  return candidate =>
    candidate.fixed && aboveEarlier.has(candidate) && belowLater.has(candidate)
}

const SIDE_COUNT = LIVE_SIDES.length

// One label per gap of each side: a gap is shared by the keys whose moves it
// holds, whatever side they move on.
const labelOf = (side: LiveSide, gap: number): number =>
  gap * SIDE_COUNT + LIVE_SIDES.indexOf(side)

const placedOn = (
  stretches: readonly Alternatives[],
  side: LiveSide
): readonly Placed[] => {
  const sorted = candidatesOn(stretches, side)
  const isSeparator = separatorTest(sorted)
  const placed: Placed[] = []
  let gap = 0
  for (const candidate of sorted) {
    if (isSeparator(candidate)) gap++
    else placed.push({ ...candidate, label: labelOf(side, gap) })
  }
  return placed
}

// Stretches owning candidates in a common gap are decided together.
const classesOf = (size: number, placed: readonly Placed[]): UnionFind => {
  const classes = new UnionFind(size)
  const owners = new Map<number, number>()
  for (const { label, stretch } of placed) {
    const owner = owners.get(label) ?? stretch
    owners.set(label, owner)
    classes.union(owner, stretch)
  }
  return classes
}

interface Layout {
  readonly placements: readonly (readonly (readonly Placed[])[])[]
  readonly fixedIn: ReadonlyMap<number, readonly Placed[]>
  readonly classes: UnionFind
}

const placementsOf = (
  stretches: readonly Alternatives[],
  placed: readonly Placed[]
): readonly (readonly (readonly Placed[])[])[] => {
  const slots = stretches.map(alternatives =>
    alternatives.map((): Placed[] => [])
  )
  for (const point of placed)
    slots[point.stretch][point.alternative].push(point)
  return slots
}

const layoutOf = (stretches: readonly Alternatives[]): Layout => {
  const placed = LIVE_SIDES.flatMap(side => placedOn(stretches, side))
  const variable = placed.filter(({ fixed }) => !fixed)
  return {
    placements: placementsOf(stretches, placed),
    fixedIn: grouped(
      placed.filter(({ fixed }) => fixed),
      ({ label }) => label
    ),
    classes: classesOf(stretches.length, variable),
  }
}

interface Component {
  readonly members: readonly number[]
  readonly labels: readonly number[]
  readonly sizes: readonly number[]
}

const componentsOf = (
  stretches: readonly Alternatives[],
  layout: Layout
): readonly Component[] => {
  const variable = stretches.flatMap((alternatives, stretch) =>
    alternatives.length > 1 ? [stretch] : []
  )
  const byRoot = grouped(variable, stretch => layout.classes.find(stretch))
  return [...byRoot.values()].map(members => ({
    members,
    labels: [
      ...new Set(
        members.flatMap(member =>
          layout.placements[member].flat().map(({ label }) => label)
        )
      ),
    ],
    sizes: members.map(member => stretches[member].length),
  }))
}

const movesIn = (points: readonly Point[]): number => {
  const sorted = [...points].sort(byAncestor)
  return sorted.length - lisLength(sorted.map(({ position }) => position))
}

const costOf =
  (component: Component, layout: Layout) =>
  (tuple: Tuple): number => {
    const chosen = grouped(
      component.members.flatMap(
        (member, at) => layout.placements[member][tuple[at]]
      ),
      ({ label }) => label
    )
    return component.labels.reduce(
      (total, label) =>
        total +
        movesIn([
          ...(layout.fixedIn.get(label) ?? []),
          ...(chosen.get(label) ?? []),
        ]),
      0
    )
  }

const following = (tuple: Tuple, sizes: Tuple): Tuple | undefined => {
  const next = [...tuple]
  for (let at = next.length - 1; at >= 0; at--) {
    next[at]++
    if (next[at] < sizes[at]) return next
    next[at] = 0
  }
  return undefined
}

function* tuplesOf(sizes: Tuple): Generator<Tuple> {
  let tuple: Tuple | undefined = sizes.map(() => 0)
  while (tuple !== undefined) {
    yield tuple
    tuple = following(tuple, sizes)
  }
}

interface Minimised extends Component {
  readonly minimal: readonly Tuple[]
}

// Every minimal tuple stays, in lexicographic order.
const minimise = (component: Component, layout: Layout): Minimised => {
  const costOfTuple = costOf(component, layout)
  let least = Number.POSITIVE_INFINITY
  let minimal: Tuple[] = []
  for (const tuple of tuplesOf(component.sizes)) {
    const cost = costOfTuple(tuple)
    if (cost < least) {
      least = cost
      minimal = []
    }
    if (cost === least) minimal.push(tuple)
  }
  return { ...component, minimal }
}

interface Range {
  readonly from: number
  readonly to: number
}

// The tuples are lexicographic, so those sharing a value at an offset and the
// values before it are contiguous.
function* runsAt(
  tuples: readonly Tuple[],
  offset: number,
  { from, to }: Range
): Generator<readonly [value: number, run: Range]> {
  let start = from
  while (start < to) {
    const value = tuples[start][offset]
    let end = start + 1
    while (end < to && tuples[end][offset] === value) end++
    yield [value, { from: start, to: end }]
    start = end
  }
}

interface Step {
  readonly stretch: number
  readonly component: number
  readonly offset: number
}

const isSettled = (minimal: readonly Tuple[], offset: number): boolean =>
  minimal.every(tuple => tuple[offset] === minimal[0][offset])

// A stretch left one value by its component has nothing to walk: nesting a
// call per such stretch would overflow the stack on long arrays.
const stepsOf = (components: readonly Minimised[]): readonly Step[] =>
  components
    .flatMap(({ members, minimal }, component) =>
      members
        .map((stretch, offset) => ({ stretch, component, offset }))
        .filter(({ offset }) => !isSettled(minimal, offset))
    )
    .sort((left, right) => left.stretch - right.stretch)

const settledChoices = (
  size: number,
  components: readonly Minimised[]
): number[] => {
  const choice = Array.from({ length: size }, () => 0)
  for (const { members, minimal } of components) {
    members.forEach((stretch, offset) => {
      choice[stretch] = minimal[0][offset]
    })
  }
  return choice
}

// Walks the stretches in order, each offering the values its component's
// minimal tuples leave it after the choices already made: the lexicographic
// order of the whole product.
class Walk {
  private readonly choice: number[]
  private readonly ranges: Range[]
  private readonly steps: readonly Step[]
  private readonly results: Tuple[] = []

  constructor(
    size: number,
    private readonly components: readonly Minimised[]
  ) {
    this.choice = settledChoices(size, components)
    this.ranges = components.map(({ minimal }) => ({
      from: 0,
      to: minimal.length,
    }))
    this.steps = stepsOf(components)
  }

  all(): readonly Tuple[] {
    this.descend(0)
    return this.results
  }

  private descend(at: number): void {
    if (at === this.steps.length) {
      this.results.push([...this.choice])
      return
    }
    const { stretch, component, offset } = this.steps[at]
    const range = this.ranges[component]
    const { minimal } = this.components[component]
    for (const [value, run] of runsAt(minimal, offset, range)) {
      this.choice[stretch] = value
      this.ranges[component] = run
      this.descend(at + 1)
    }
    this.ranges[component] = range
  }
}

/**
 * Every choice of one alternative per stretch with the fewest moves, in
 * lexicographic order. The moves of a choice are the entries off the longest
 * increasing run of each live side. Fixed points that every other point lies
 * on one side of cut the plane into gaps: only the stretches sharing a gap
 * trade moves, so each group of them is chosen apart from the others.
 */
export const fewestMoves = (
  stretches: readonly Alternatives[]
): readonly Tuple[] => {
  const layout = layoutOf(stretches)
  const components = componentsOf(stretches, layout).map(component =>
    minimise(component, layout)
  )
  return new Walk(stretches.length, components).all()
}
