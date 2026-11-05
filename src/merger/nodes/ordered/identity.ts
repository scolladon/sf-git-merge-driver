import type { JsonArray, JsonObject } from '../../../types/jsonTypes.js'
import { signatureOf } from '../../../utils/jsonSignature.js'
import type { KeyedSides } from '../KeyedArrayIndex.js'
import {
  groupSides,
  type Pairing,
  readings,
  type SideGroups,
} from '../keyedReadings.js'
import { lisLength } from './orderAxis.js'
import {
  ABSENT_POSITION,
  isOn,
  LIVE_SIDES,
  type LiveSide,
  type OrderedEntry,
  positionOn,
  type Reading,
} from './orderedEntry.js'

interface Slot {
  readonly pos: number
  readonly value: JsonObject
}

type Slots = SideGroups<Slot>

const groupSlots = (
  sides: Readonly<Record<keyof Slots, JsonArray>>,
  keys: KeyedSides
): ReadonlyMap<string, Slots> =>
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

// The alternatives of a stretch of keys, read again by the cross product for
// each combination of the stretches before it.
type Segment = () => Iterable<readonly Draft[]>

type Alternatives = readonly (readonly Draft[])[]

// A fused run of keys held at most once per side has one alternative and no
// slots to choose from.
interface Stretch {
  readonly alternatives: Alternatives
  readonly slots: Slots | undefined
}

// Keys with a single alternative fuse into one stretch: recursing over every
// key would nest as deep as the array is long.
const stretchesOf = (
  groups: ReadonlyMap<string, Slots>
): readonly Stretch[] => {
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

function* crossProduct(
  segments: readonly Segment[],
  from: number,
  prefix: readonly Draft[]
): Generator<readonly Draft[]> {
  if (from === segments.length) {
    yield prefix
    return
  }
  for (const drafts of segments[from]()) {
    yield* crossProduct(segments, from + 1, [...prefix, ...drafts])
  }
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

const movesOn = (reading: Reading, side: LiveSide): number => {
  const kept = reading
    .filter(entry => entry.ancestor !== undefined && isOn(entry, side))
    .sort((left, right) => left.ancestorPos - right.ancestorPos)
  return kept.length - lisLength(kept.map(entry => positionOn(entry, side)))
}

const movesOf = (reading: Reading): number =>
  LIVE_SIDES.reduce((total, side) => total + movesOn(reading, side), 0)

function* mapped<T, U>(items: Iterable<T>, fn: (item: T) => U): Generator<U> {
  for (const item of items) yield fn(item)
}

interface Leaders {
  readonly offer: (reading: Reading) => void
  readonly kept: () => readonly Reading[]
}

const leadersBy = (measure: (reading: Reading) => number): Leaders => {
  // Stryker disable next-line ArrayDeclaration: the first offer resets kept: a measure is finite (a boolean or a count), so it is below the initial infinity
  let kept: Reading[] = []
  let least = Number.POSITIVE_INFINITY
  return {
    offer: reading => {
      const value = measure(reading)
      if (value < least) {
        least = value
        kept = []
      }
      if (value === least) kept.push(reading)
    },
    kept: () => kept,
  }
}

// Streams the candidates, holding only the best ones. A lone candidate is
// the best whatever the measure says: it is returned unmeasured.
const keepLeast = (
  readings: Iterable<Reading>,
  measure: (reading: Reading) => number
): readonly Reading[] => {
  const leaders = leadersBy(measure)
  let lone: Reading | undefined
  for (const reading of readings) {
    // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: the lone slot only defers offering the first reading; offering it at once keeps the same leaders
    if (lone === undefined && leaders.kept().length === 0) {
      lone = reading
      continue
    }
    if (lone !== undefined) leaders.offer(lone)
    lone = undefined
    leaders.offer(reading)
  }
  return lone === undefined ? leaders.kept() : [lone]
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

const leastMovingReadings = (
  lists: readonly Alternatives[]
): readonly Reading[] => {
  const segments: readonly Segment[] = lists.map(list => () => list)
  return keepLeast(mapped(crossProduct(segments, 0, []), toReading), movesOf)
}

const hasOneAlternative = (stretch: Stretch): boolean =>
  stretch.alternatives.length === 1

export const identify = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray,
  keys: KeyedSides
): readonly Reading[] => {
  // A value determines its key (a field of the entry, or its whole content),
  // so the values both sides hold split across keys and each key is judged
  // alone.
  const stretches = stretchesOf(groupSlots({ ancestor, local, other }, keys))
  if (stretches.every(hasOneAlternative)) {
    return [toReading(stretches.flatMap(stretch => stretch.alternatives[0]))]
  }
  return leastMovingReadings(withoutLosses(stretches))
}
