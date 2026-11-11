import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import { signatureOf } from '../../../utils/jsonSignature.js'
import type { KeyedSides } from '../KeyedArrayIndex.js'
import {
  groupSides,
  type Pairing,
  readings,
  type SideGroups,
} from '../keyedReadings.js'
import {
  firstChoice,
  type Point,
  type PointSet,
  projected,
  type TieComponent,
  type Tuple,
  tieComponents,
  walkAround,
} from './identityComponents.js'
import {
  ABSENT_POSITION,
  type LiveSide,
  type OrderedEntry,
  type Reading,
} from './orderedEntry.js'

interface Slot {
  readonly pos: number
  readonly value: JsonObject
}

type Slots = SideGroups<Slot>

type SlotsByKey = ReadonlyMap<string, Slots>

const groupSlots = (
  sides: Readonly<Record<keyof Slots, JsonArray>>,
  keys: KeyedSides
): SlotsByKey =>
  groupSides(keys, (side, pos) => ({
    pos,
    value: sides[side][pos] as JsonObject,
  }))

const positionOf = (slot: Slot | undefined): number =>
  slot?.pos ?? ABSENT_POSITION

interface Draft {
  readonly key: string
  readonly ancestor: Slot | undefined
  readonly local: Slot | undefined
  readonly other: Slot | undefined
}

const isUnique = (slots: Slots): boolean =>
  slots.ancestor.length <= 1 &&
  slots.local.length <= 1 &&
  slots.other.length <= 1

interface Clones {
  readonly copies: Readonly<Record<keyof Slots, JsonObject[]>>
  readonly slotOf: ReadonlyMap<JsonObject, Slot>
}

const cloneSlots = (slots: Slots): Clones => {
  const slotOf = new Map<JsonObject, Slot>()
  const cloned = (side: readonly Slot[]): JsonObject[] =>
    side.map(slot => {
      const clone = { ...slot.value }
      slotOf.set(clone, slot)
      return clone
    })
  const copies = {
    ancestor: cloned(slots.ancestor),
    local: cloned(slots.local),
    other: cloned(slots.other),
  }
  return { copies, slotOf }
}

// readings() pairs values and may meet two equal ones: distinct clones tell
// the copies apart so each pairing finds back its slot.
function* pairingDrafts(key: string, slots: Slots): Generator<Draft[]> {
  const { copies, slotOf } = cloneSlots(slots)
  const draftOf = (pairing: Pairing): Draft => ({
    key,
    ancestor: pairing.ancestor && slotOf.get(pairing.ancestor),
    local: pairing.local && slotOf.get(pairing.local),
    other: pairing.other && slotOf.get(pairing.other),
  })
  for (const pairings of readings(copies)) yield pairings.map(draftOf)
}

const uniqueDraft = (key: string, slots: Slots): Draft => ({
  key,
  ancestor: slots.ancestor[0],
  local: slots.local[0],
  other: slots.other[0],
})

type Alternatives = readonly (readonly Draft[])[]

// A fused run of keys held at most once per side has one alternative and no
// slots to choose from.
interface Stretch {
  readonly alternatives: Alternatives
  readonly slots: Slots | undefined
}

// Keys with a single alternative fuse into one stretch: recursing over every
// key would nest as deep as the array is long.
const stretchesOf = (groups: SlotsByKey): readonly Stretch[] => {
  const stretches: Stretch[] = []
  let run: Draft[] = []
  const closeRun = (): void => {
    // Stryker disable next-line ConditionalExpression: an empty fused run adds a segment yielding the empty draft list, the identity of the cross product
    if (run.length === 0) return
    stretches.push({ alternatives: [run], slots: undefined })
    run = []
  }
  for (const [key, slots] of groups) {
    if (isUnique(slots)) {
      run.push(uniqueDraft(key, slots))
      continue
    }
    closeRun()
    stretches.push({ alternatives: [...pairingDrafts(key, slots)], slots })
  }
  closeRun()
  return stretches
}

const toReading = (drafts: readonly Draft[]): Reading =>
  drafts.map(
    (draft, id): OrderedEntry => ({
      id,
      key: draft.key,
      ...(draft.ancestor && { ancestor: draft.ancestor.value }),
      ...(draft.local && { local: draft.local.value }),
      ...(draft.other && { other: draft.other.value }),
      ancestorPos: positionOf(draft.ancestor),
      localPos: positionOf(draft.local),
      otherPos: positionOf(draft.other),
    })
  )

const valuesBothSidesHold = (
  local: JsonArray,
  other: JsonArray
): ReadonlySet<string> => {
  const otherSignatures = new Set((other as JsonObject[]).map(signatureOf))
  return new Set(
    (local as JsonObject[]).map(signatureOf).filter(s => otherSignatures.has(s))
  )
}

const isOnBothSides = (entry: OrderedEntry): boolean =>
  entry.local !== undefined && entry.other !== undefined

const sharedSignatures = (reading: Reading): ReadonlySet<string> => {
  const shared = new Set<string>()
  for (const entry of reading.filter(isOnBothSides)) {
    shared.add(signatureOf(entry.local as JsonObject))
    shared.add(signatureOf(entry.other as JsonObject))
  }
  return shared
}

// A reading loses a value when no entry shared by both sides carries it.
const losesAValue = (reading: Reading, held: ReadonlySet<string>): boolean => {
  const shared = sharedSignatures(reading)
  return [...held].some(signature => !shared.has(signature))
}

const valuesOf = (slots: readonly Slot[]): JsonArray =>
  slots.map(slot => slot.value)

// Exact per key: the values a key's entries carry belong to it alone.
const noLossOf = (stretch: Stretch): Alternatives => {
  const { alternatives, slots } = stretch
  if (slots === undefined) return alternatives
  const held = valuesBothSidesHold(valuesOf(slots.local), valuesOf(slots.other))
  return alternatives.filter(
    alternative => !losesAValue(toReading(alternative), held)
  )
}

const withoutLosses = (
  stretches: readonly Stretch[]
): readonly Alternatives[] => {
  const kept = stretches.map(noLossOf)
  // A key losing a value in every alternative makes every reading lose: all
  // of them stay, as when no reading avoids a loss.
  return kept.every(alternatives => alternatives.length > 0)
    ? kept
    : stretches.map(stretch => stretch.alternatives)
}

const pointsOn = (drafts: readonly Draft[], side: LiveSide): Point[] => {
  const points: Point[] = []
  for (const draft of drafts) {
    const { ancestor } = draft
    const slot = draft[side]
    if (ancestor && slot) {
      points.push({ ancestor: ancestor.pos, position: slot.pos })
    }
  }
  return points
}

const pointsOf = (drafts: readonly Draft[]): PointSet => ({
  local: pointsOn(drafts, 'local'),
  other: pointsOn(drafts, 'other'),
})

const hasOneAlternative = (stretch: Stretch): boolean =>
  stretch.alternatives.length === 1

/** The tie set of the readings, exposed for a merge that walks it by parts. */
export interface IdentityTies {
  readonly first: Tuple
  readonly components: readonly TieComponent[]
  readonly readingOf: (tuple: Tuple) => Reading
  // A component's stretch holds one key: fused stretches are never tied.
  readonly keyOf: (stretch: number) => string
  readonly readings: () => Iterable<Reading>
  readonly around: (
    components: readonly number[],
    base: Tuple
  ) => Iterable<Tuple>
}

function* readingsAlong(
  tuples: Iterable<Tuple>,
  readingOf: (tuple: Tuple) => Reading
): Generator<Reading> {
  for (const tuple of tuples) yield readingOf(tuple)
}

/** The tie set with the first reading of each group of interchangeable ones. */
export interface GroupedTies extends IdentityTies {
  // The groups are the readings choosing alike on every stretch whose key is
  // not in the set; each comes once, at its first reading, in stream order.
  readonly representatives: (
    collapsible: ReadonlySet<string>
  ) => Iterable<Reading>
}

type Walked = Pick<IdentityTies, 'components' | 'first' | 'keyOf' | 'readingOf'>

const aroundOf =
  (components: readonly TieComponent[]): IdentityTies['around'] =>
  (selected, base) =>
    walkAround(
      selected.map(at => components[at]),
      base
    )

const representativesOf =
  ({ components, first, keyOf, readingOf }: Walked) =>
  (collapsible: ReadonlySet<string>): Iterable<Reading> => {
    const isFixed = (stretch: number): boolean =>
      !collapsible.has(keyOf(stretch))
    const reduced = components.map(component => projected(component, isFixed))
    return readingsAlong(walkAround(reduced, first), readingOf)
  }

const tiesOver = (
  kept: readonly Alternatives[],
  components: readonly TieComponent[]
): GroupedTies => {
  const first = firstChoice(kept.length, components)
  const keyOf = (stretch: number): string => kept[stretch][0][0].key
  const readingOf = (tuple: Tuple): Reading =>
    toReading(tuple.flatMap((choice, at) => kept[at][choice]))
  return {
    first,
    components,
    readingOf,
    keyOf,
    readings: () => readingsAlong(walkAround(components, first), readingOf),
    around: aroundOf(components),
    representatives: representativesOf({ components, first, keyOf, readingOf }),
  }
}

// Each stretch keeps its no-loss alternatives; the fewest-move choices are
// decided per group of stretches that share a gap, and walked back in the
// order of the cross product of the alternatives.
export const identityTies = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
): GroupedTies => {
  // A value determines its key (a field of the entry, or its whole content),
  // so the values both sides hold split across keys and each key is judged
  // alone.
  const stretches = stretchesOf(groupSlots({ ancestor, local, other }, keys))
  if (stretches.every(hasOneAlternative)) {
    return tiesOver(
      stretches.map(stretch => stretch.alternatives),
      []
    )
  }
  const kept = withoutLosses(stretches)
  const points = kept.map(alternatives => alternatives.map(pointsOf))
  return tiesOver(kept, tieComponents(points))
}
