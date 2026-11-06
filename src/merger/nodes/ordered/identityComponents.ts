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

export type Tuple = readonly number[]

interface Candidate extends Point {
  readonly stretch: number
  readonly alternative: number
  readonly fixed: boolean
}

// A candidate between two gap boundaries (separators or empty splits) belongs
// to the gap they bound.
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

// The lowest position from each index on, +infinity past the end.
const suffixMinima = (positions: readonly number[]): readonly number[] => {
  const lowest = [...positions, Number.POSITIVE_INFINITY]
  for (let at = positions.length - 1; at >= 0; at--) {
    lowest[at] = Math.min(lowest[at], lowest[at + 1])
  }
  return lowest
}

// Where every candidate before lies below every candidate after on both
// coordinates, the longest increasing runs add up across the boundary: the
// plane splits there with no fixed point between.
const emptySplits = (sorted: readonly Candidate[]): ReadonlySet<Candidate> => {
  const lowestFrom = suffixMinima(sorted.map(({ position }) => position))
  const splits = new Set<Candidate>()
  let highest = Number.NEGATIVE_INFINITY
  for (const [at, candidate] of sorted.entries()) {
    const previous = sorted[at - 1]
    const opens =
      at > 0 &&
      previous.ancestor < candidate.ancestor &&
      highest < lowestFrom[at]
    if (opens) splits.add(candidate)
    highest = Math.max(highest, candidate.position)
  }
  return splits
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
  const splits = emptySplits(sorted)
  const placed: Placed[] = []
  let gap = 0
  for (const candidate of sorted) {
    if (splits.has(candidate)) gap++
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

/** A component with its fewest-move tuples, in lexicographic order. */
export interface TieComponent extends Component {
  readonly minimal: readonly Tuple[]
}

// Every minimal tuple stays, in lexicographic order.
const minimise = (component: Component, layout: Layout): TieComponent => {
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

interface Level {
  readonly runs: Iterator<readonly [value: number, run: Range]>
  readonly range: Range
}

interface Step {
  readonly stretch: number
  readonly component: number
  readonly offset: number
}

const isSettled = (minimal: readonly Tuple[], offset: number): boolean =>
  minimal.every(tuple => tuple[offset] === minimal[0][offset])

// A stretch left one value by its component has nothing to walk: settledChoices
// fixes it once instead of giving it a level of the walk.
const stepsOf = (components: readonly TieComponent[]): readonly Step[] =>
  components
    .flatMap(({ members, minimal }, component) =>
      members
        .map((stretch, offset) => ({ stretch, component, offset }))
        .filter(({ offset }) => !isSettled(minimal, offset))
    )
    .sort((left, right) => left.stretch - right.stretch)

const settledChoices = (
  base: Tuple,
  components: readonly TieComponent[]
): number[] => {
  const choice = [...base]
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

  constructor(
    base: Tuple,
    private readonly components: readonly TieComponent[]
  ) {
    this.choice = settledChoices(base, components)
    this.ranges = components.map(({ minimal }) => ({
      from: 0,
      to: minimal.length,
    }))
    this.steps = stepsOf(components)
  }

  // One level per unsettled stretch on an explicit stack: a call frame per
  // stretch overflowed the stack at a few thousand stretches.
  *tuples(): Generator<Tuple> {
    if (this.steps.length === 0) {
      yield [...this.choice]
      return
    }
    const levels: Level[] = [this.open(0)]
    while (levels.length > 0) {
      const at = levels.length - 1
      const next = levels[at].runs.next()
      if (next.done) {
        this.close(levels)
        continue
      }
      this.take(at, next.value)
      if (at + 1 === this.steps.length) yield [...this.choice]
      else levels.push(this.open(at + 1))
    }
  }

  private open(at: number): Level {
    const { component, offset } = this.steps[at]
    const range = this.ranges[component]
    const { minimal } = this.components[component]
    return { runs: runsAt(minimal, offset, range), range }
  }

  private take(at: number, [value, run]: readonly [number, Range]): void {
    const { stretch, component } = this.steps[at]
    this.choice[stretch] = value
    this.ranges[component] = run
  }

  private close(levels: Level[]): void {
    const { component } = this.steps[levels.length - 1]
    this.ranges[component] = (levels.pop() as Level).range
  }
}

/**
 * Each group of stretches sharing a gap with its fewest-move choices, every tie
 * kept. The moves of a choice are the entries off the longest increasing run
 * of each live side. Fixed points that every other point lies on one side of,
 * and empty splits where every point before lies below every point after, cut
 * the plane into gaps: only the stretches sharing a gap trade moves.
 */
export const tieComponents = (
  stretches: readonly Alternatives[]
): readonly TieComponent[] => {
  const layout = layoutOf(stretches)
  return componentsOf(stretches, layout).map(component =>
    minimise(component, layout)
  )
}

// Every component at its least tuple: the first choice of the walk.
export const firstChoice = (
  size: number,
  components: readonly TieComponent[]
): Tuple =>
  settledChoices(
    Array.from({ length: size }, () => 0),
    components
  )

// The choices of the given components in lexicographic order, every other
// stretch kept as in base.
export const walkAround = (
  components: readonly TieComponent[],
  base: Tuple
): Iterable<Tuple> => new Walk(base, components).tuples()

// Joins one tuple's choices into a map key
const CHOICE_SEPARATOR = ','

// The tuples agreeing on the kept stretches, the first of each: the list keeps
// its lexicographic order and its least tuple, so the walk meets each choice
// of those stretches once, at its first tuple.
export const projected = (
  component: TieComponent,
  keeps: (stretch: number) => boolean
): TieComponent => {
  const offsets = component.members.flatMap((stretch, offset) =>
    keeps(stretch) ? [offset] : []
  )
  const firstOf = new Map<string, Tuple>()
  for (const tuple of component.minimal) {
    const choice = offsets.map(offset => tuple[offset]).join(CHOICE_SEPARATOR)
    if (!firstOf.has(choice)) firstOf.set(choice, tuple)
  }
  return { ...component, minimal: [...firstOf.values()] }
}
