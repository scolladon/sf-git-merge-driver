import { UnionFind } from './conflictSeeds.js'
import { lisLength } from './orderAxis.js'
import { LIVE_SIDES, type LiveSide } from './orderedEntry.js'

/** An entry holding an ancestor copy and a copy of one live side. */
export interface Point {
  readonly ancestor: number
  readonly position: number
}

/**
 * The points of one alternative on a live side, built when a pass asks for
 * them. Alternatives that pair a side alike hand the same array.
 */
export type PointSet = (side: LiveSide) => readonly Point[]

type Alternatives = readonly PointSet[]

export type Tuple = readonly number[]

const byAncestor = (left: Point, right: Point): number =>
  left.ancestor - right.ancestor

const addTo = <Key, Item>(
  groups: Map<Key, Item[]>,
  key: Key,
  item: Item
): void => {
  const group = groups.get(key)
  if (group === undefined) groups.set(key, [item])
  else group.push(item)
}

const grouped = <Item, Key>(
  items: readonly Item[],
  keyOf: (item: Item) => Key
): ReadonlyMap<Key, readonly Item[]> => {
  const groups = new Map<Key, Item[]>()
  for (const item of items) addTo(groups, keyOf(item), item)
  return groups
}

// Alternatives that pair a side alike hand the same array: it is read once.
function* unreadIn(
  alternatives: Alternatives,
  side: LiveSide,
  read: Set<readonly Point[]>
): Generator<Point> {
  for (const set of alternatives) {
    const points = set(side)
    if (read.has(points)) continue
    read.add(points)
    yield* points
  }
}

function* pointsOn(
  stretches: readonly Alternatives[],
  side: LiveSide
): Generator<Point> {
  const read = new Set<readonly Point[]>()
  for (const alternatives of stretches)
    yield* unreadIn(alternatives, side, read)
}

// The positions the candidates of one ancestor copy take on a side, whatever
// the alternative.
interface Span {
  readonly lowest: number
  readonly highest: number
}

const widened = (span: Span | undefined, position: number): Span =>
  span === undefined
    ? { lowest: position, highest: position }
    : {
        lowest: Math.min(span.lowest, position),
        highest: Math.max(span.highest, position),
      }

const spansOn = (
  stretches: readonly Alternatives[],
  side: LiveSide
): ReadonlyMap<number, Span> => {
  const spans = new Map<number, Span>()
  for (const { ancestor, position } of pointsOn(stretches, side)) {
    spans.set(ancestor, widened(spans.get(ancestor), position))
  }
  return spans
}

// The lowest position from each index on, +infinity past the end.
const suffixMinima = (positions: readonly number[]): readonly number[] => {
  const lowest = [...positions, Number.POSITIVE_INFINITY]
  for (let at = positions.length - 1; at >= 0; at--) {
    lowest[at] = Math.min(lowest[at], lowest[at + 1])
  }
  return lowest
}

const SIDE_COUNT = LIVE_SIDES.length

// One label per gap of each side: a gap is shared by the keys whose moves it
// holds, whatever side they move on.
const labelOf = (side: LiveSide, gap: number): number =>
  gap * SIDE_COUNT + LIVE_SIDES.indexOf(side)

// Where every candidate before lies below every candidate after on both
// coordinates, the longest increasing runs add up across the boundary: the
// plane splits there. A fixed point every other candidate lies below or above
// on both coordinates opens a split before and after itself, so it needs no
// test of its own. The candidates of one ancestor copy share a coordinate, so
// they share a gap: the splits are looked for between the copies, never
// between the candidates.
const labelsOn = (
  stretches: readonly Alternatives[],
  side: LiveSide
): ReadonlyMap<number, number> => {
  const spans = [...spansOn(stretches, side)].sort(
    ([left], [right]) => left - right
  )
  const lowestFrom = suffixMinima(spans.map(([, { lowest }]) => lowest))
  const labels = new Map<number, number>()
  let gap = 0
  let reached = Number.NEGATIVE_INFINITY
  for (const [at, [ancestor, { highest }]] of spans.entries()) {
    // A gap is numbered after the copy that opens it: nothing is reached before
    // the first copy, which opens the first gap
    if (reached < lowestFrom[at]) gap = at
    labels.set(ancestor, labelOf(side, gap))
    reached = Math.max(reached, highest)
  }
  return labels
}

// The gap each ancestor copy lies in, per side.
type Labels = Readonly<Record<LiveSide, ReadonlyMap<number, number>>>

// Every point was spanned, so its ancestor copy holds a label.
const labelIn = (labels: Labels, side: LiveSide, point: Point): number =>
  labels[side].get(point.ancestor) as number

// Adds the points of an alternative to the gaps they lie in.
const gather = (
  into: Map<number, Point[]>,
  set: PointSet,
  labels: Labels
): void => {
  for (const side of LIVE_SIDES) {
    for (const point of set(side)) {
      addTo(into, labelIn(labels, side, point), point)
    }
  }
}

const fixedPoints = (
  stretches: readonly Alternatives[],
  labels: Labels
): ReadonlyMap<number, readonly Point[]> => {
  const fixed = new Map<number, Point[]>()
  for (const alternatives of stretches) {
    if (alternatives.length === 1) gather(fixed, alternatives[0], labels)
  }
  return fixed
}

const NO_GAP: ReadonlySet<number> = new Set()

// The gaps the alternatives of a stretch reach: none matter for a stretch
// with a single alternative, which trades no move.
const gapsOf = (
  alternatives: Alternatives,
  labels: Labels
): ReadonlySet<number> => {
  if (alternatives.length <= 1) return NO_GAP
  const gaps = new Set<number>()
  for (const side of LIVE_SIDES) {
    for (const point of pointsOn([alternatives], side)) {
      gaps.add(labelIn(labels, side, point))
    }
  }
  return gaps
}

// Stretches owning candidates in a common gap are decided together.
const classesOf = (gaps: readonly ReadonlySet<number>[]): UnionFind => {
  const classes = new UnionFind(gaps.length)
  const owners = new Map<number, number>()
  gaps.forEach((labels, stretch) => {
    for (const label of labels) {
      const owner = owners.get(label) ?? stretch
      owners.set(label, owner)
      classes.union(owner, stretch)
    }
  })
  return classes
}

interface Layout {
  readonly labels: Labels
  readonly gaps: readonly ReadonlySet<number>[]
  readonly fixedIn: ReadonlyMap<number, readonly Point[]>
  readonly classes: UnionFind
}

const layoutOf = (stretches: readonly Alternatives[]): Layout => {
  const labels = {
    local: labelsOn(stretches, 'local'),
    other: labelsOn(stretches, 'other'),
  }
  const gaps = stretches.map(alternatives => gapsOf(alternatives, labels))
  return {
    labels,
    gaps,
    fixedIn: fixedPoints(stretches, labels),
    classes: classesOf(gaps),
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
    labels: [...new Set(members.flatMap(member => [...layout.gaps[member]]))],
    sizes: members.map(member => stretches[member].length),
  }))
}

const movesIn = (points: readonly Point[]): number => {
  const sorted = [...points].sort(byAncestor)
  return sorted.length - lisLength(sorted.map(({ position }) => position))
}

const sideOf = (label: number): LiveSide => LIVE_SIDES[label % SIDE_COUNT]

const pointsIn = (
  layout: Layout,
  byGap: ReadonlyMap<number, readonly Point[]>,
  label: number
): readonly Point[] => [
  ...(layout.fixedIn.get(label) ?? []),
  ...(byGap.get(label) ?? []),
]

// The moves the chosen points of one side add up to over the side's gaps.
const movesOn = (
  side: LiveSide,
  labels: readonly number[],
  layout: Layout,
  chosen: readonly (readonly Point[])[]
): number => {
  const byGap = new Map<number, Point[]>()
  for (const points of chosen) {
    for (const point of points) {
      addTo(byGap, labelIn(layout.labels, side, point), point)
    }
  }
  return labels.reduce(
    (total, label) => total + movesIn(pointsIn(layout, byGap, label)),
    0
  )
}

type Cost = (tuple: Tuple) => number

// The same points make the same moves: tuples handing an array already
// counted reuse its count.
const oncePerPoints = (
  pointsOf: (tuple: Tuple) => readonly Point[],
  count: (points: readonly Point[]) => number
): Cost => {
  const known = new WeakMap<readonly Point[], number>()
  return tuple => {
    const points = pointsOf(tuple)
    const moves = known.get(points)
    if (moves !== undefined) return moves
    const counted = count(points)
    known.set(points, counted)
    return counted
  }
}

// A gap belongs to one side, so a side's moves read that side's points only.
// A component of one key is counted once per points array; the arrays of
// several keys combine, so they are counted per tuple.
const sideCostOf = (
  stretches: readonly Alternatives[],
  component: Component,
  layout: Layout,
  side: LiveSide
): Cost => {
  const labels = component.labels.filter(label => sideOf(label) === side)
  const count = (chosen: readonly (readonly Point[])[]): number =>
    movesOn(side, labels, layout, chosen)
  const { members } = component
  if (members.length !== 1) {
    return tuple =>
      count(members.map((member, at) => stretches[member][tuple[at]](side)))
  }
  const [lone] = members
  return oncePerPoints(
    tuple => stretches[lone][tuple[0]](side),
    points => count([points])
  )
}

const costOf = (
  stretches: readonly Alternatives[],
  component: Component,
  layout: Layout
): Cost => {
  const local = sideCostOf(stretches, component, layout, 'local')
  const other = sideCostOf(stretches, component, layout, 'other')
  return tuple => local(tuple) + other(tuple)
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

// A component left two least tuples or more varies across the readings.
const FEWEST_TIED_TUPLES = 2

export const isTied = (component: TieComponent): boolean =>
  component.minimal.length >= FEWEST_TIED_TUPLES

// Every minimal tuple stays, in lexicographic order.
const minimise = (
  stretches: readonly Alternatives[],
  component: Component,
  layout: Layout
): TieComponent => {
  const costOfTuple = costOf(stretches, component, layout)
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
 * of each live side. Empty splits, where every point before lies below every
 * point after, cut the plane into gaps: only the stretches sharing a gap trade
 * moves.
 */
export const tieComponents = (
  stretches: readonly Alternatives[]
): readonly TieComponent[] => {
  const layout = layoutOf(stretches)
  return componentsOf(stretches, layout).map(component =>
    minimise(stretches, component, layout)
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
