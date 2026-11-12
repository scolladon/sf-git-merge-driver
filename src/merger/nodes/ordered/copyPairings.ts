import type { JsonObject } from '../../../types/jsonTypes.js'
import { pushAll } from '../../../utils/arrayUtils.js'
import {
  type Matching,
  matchingsOf,
  type SideGroups,
  surplusMatchings,
} from '../keyedReadings.js'
import type { LiveSide } from './orderedEntry.js'

export interface Slot {
  readonly pos: number
  readonly value: JsonObject
}

export type Slots = SideGroups<Slot>

export interface Draft {
  readonly key: string
  readonly ancestor: Slot | undefined
  readonly local: Slot | undefined
  readonly other: Slot | undefined
}

interface KeySlots {
  readonly key: string
  readonly slots: Slots
}

// An ancestor copy the side does not pair: no index of a side's copy is
// negative
const NO_COPY = -1

// One side's pairing with the ancestor copies of a key, shared by every
// alternative that pairs the side alike
interface SidePairing {
  // The side's copy each ancestor copy takes, NO_COPY when it takes none
  readonly copyAt: readonly number[]
  // The side's copies left unpaired, in order, and their values
  readonly rest: readonly number[]
  readonly restValues: readonly JsonObject[]
}

// A rest pair holds [local rest index, other rest index]
const PAIR_PLACE: Readonly<Record<LiveSide, 0 | 1>> = { local: 0, other: 1 }

const valuesOf = (side: readonly Slot[]): JsonObject[] =>
  side.map(slot => slot.value)

const slotAt = (side: readonly Slot[], copy: number): Slot | undefined =>
  copy === NO_COPY ? undefined : side[copy]

const sidePairingOf = (
  matching: Matching,
  ancestorCount: number,
  side: readonly Slot[]
): SidePairing => {
  const copyAt: number[] = Array.from({ length: ancestorCount }, () => NO_COPY)
  for (const [ancestor, copy] of matching) copyAt[ancestor] = copy
  const paired = new Set(copyAt)
  const rest = side.flatMap((_, copy) => (paired.has(copy) ? [] : [copy]))
  return { copyAt, rest, restValues: rest.map(copy => side[copy].value) }
}

function* sidePairings(slots: Slots, side: LiveSide): Generator<SidePairing> {
  const ancestor = valuesOf(slots.ancestor)
  for (const matching of matchingsOf(ancestor, valuesOf(slots[side]))) {
    yield sidePairingOf(matching, ancestor.length, slots[side])
  }
}

const NO_PAIRS: Matching = []

// A side with no copy left pairs none: the one empty matching
const restMatchings = (
  local: SidePairing,
  other: SidePairing
): Iterable<Matching> =>
  local.rest.length === 0 || other.rest.length === 0
    ? [NO_PAIRS]
    : surplusMatchings(local.restValues, other.restValues)

const loneDraft = (key: string, side: LiveSide, slot: Slot): Draft => ({
  key,
  ancestor: undefined,
  local: undefined,
  other: undefined,
  [side]: slot,
})

// One way to read a key's copies as the same entries on the three sides
export class PairedCopies {
  constructor(
    private readonly group: KeySlots,
    private readonly local: SidePairing,
    private readonly other: SidePairing,
    private readonly rest: Matching
  ) {}

  // In the order the readings of the copies give them
  drafts(): readonly Draft[] {
    const drafts = this.ancestorDrafts()
    pushAll(
      drafts,
      this.restPairDrafts(),
      this.unpairedDrafts('local'),
      this.unpairedDrafts('other')
    )
    return drafts
  }

  private ancestorDrafts(): Draft[] {
    const { key, slots } = this.group
    return slots.ancestor.map((ancestor, index) => ({
      key,
      ancestor,
      local: slotAt(slots.local, this.local.copyAt[index]),
      other: slotAt(slots.other, this.other.copyAt[index]),
    }))
  }

  private restPairDrafts(): Draft[] {
    const { key, slots } = this.group
    return this.rest.map(([local, other]) => ({
      key,
      ancestor: undefined,
      local: slots.local[this.local.rest[local]],
      other: slots.other[this.other.rest[other]],
    }))
  }

  private unpairedDrafts(side: LiveSide): Draft[] {
    const { key, slots } = this.group
    const place = PAIR_PLACE[side]
    const paired = new Set(this.rest.map(pair => pair[place]))
    return this[side].rest.flatMap((copy, index) =>
      paired.has(index) ? [] : [loneDraft(key, side, slots[side][copy])]
    )
  }
}

function* pairedWith(
  group: KeySlots,
  local: SidePairing,
  others: readonly SidePairing[]
): Generator<PairedCopies> {
  for (const other of others) {
    for (const rest of restMatchings(local, other)) {
      yield new PairedCopies(group, local, other, rest)
    }
  }
}

// Every way to read a key's copies: the other side's pairings do not depend
// on local's, so they are enumerated once and shared
export const pairedCopiesOf = (
  key: string,
  slots: Slots
): readonly PairedCopies[] => {
  const group = { key, slots }
  const others = Array.from(sidePairings(slots, 'other'))
  const alternatives: PairedCopies[] = []
  for (const local of sidePairings(slots, 'local')) {
    pushAll(alternatives, Array.from(pairedWith(group, local, others)))
  }
  return alternatives
}
