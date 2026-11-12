import type { JsonObject } from '../../../types/jsonTypes.js'
import { pushAll } from '../../../utils/arrayUtils.js'
import {
  type Matching,
  matchingsOf,
  type SideGroups,
  surplusMatchings,
} from '../keyedReadings.js'
import type { Point } from './identityComponents.js'
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

// The points of a side pairing, known to every alternative sharing it
export type KnownPoints = Map<SidePairing, readonly Point[]>

// One way to read a key's entries, its drafts and points built when asked for
export interface Alternative {
  readonly key: string
  drafts(): readonly Draft[]
  pointsOn(side: LiveSide, known: KnownPoints): readonly Point[]
}

// The signature of each copy of a key on a live side, by copy index
export interface SideSignatures {
  readonly local: readonly string[]
  readonly other: readonly string[]
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

const pairedPoints = (
  slots: Slots,
  side: LiveSide,
  pairing: SidePairing
): readonly Point[] => {
  const points: Point[] = []
  for (const [ancestor, copy] of pairing.copyAt.entries()) {
    if (copy === NO_COPY) continue
    points.push({
      ancestor: slots.ancestor[ancestor].pos,
      position: slots[side][copy].pos,
    })
  }
  return points
}

// The copies of the entries both sides hold: [local copy, other copy]
function* sharedCopies(
  local: SidePairing,
  other: SidePairing,
  rest: Matching
): Generator<readonly [number, number]> {
  for (const [ancestor, copy] of local.copyAt.entries()) {
    const twin = other.copyAt[ancestor]
    if (copy !== NO_COPY && twin !== NO_COPY) yield [copy, twin]
  }
  for (const [left, right] of rest) yield [local.rest[left], other.rest[right]]
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
export class PairedCopies implements Alternative {
  // Built when a reading first takes the alternative: few are ever read
  private built: readonly Draft[] | undefined

  constructor(
    private readonly group: KeySlots,
    private readonly local: SidePairing,
    private readonly other: SidePairing,
    private readonly rest: Matching
  ) {}

  get key(): string {
    return this.group.key
  }

  drafts(): readonly Draft[] {
    this.built ??= this.build()
    return this.built
  }

  // A side pairing's points are built once for all the alternatives sharing it
  pointsOn(side: LiveSide, known: KnownPoints): readonly Point[] {
    const pairing = this[side]
    const points =
      known.get(pairing) ?? pairedPoints(this.group.slots, side, pairing)
    known.set(pairing, points)
    return points
  }

  // An alternative loses a value when no entry shared by both sides carries it
  loses(held: ReadonlySet<string>, signatures: SideSignatures): boolean {
    const missing = new Set(held)
    const shared = sharedCopies(this.local, this.other, this.rest)
    for (const [local, other] of shared) {
      missing.delete(signatures.local[local])
      missing.delete(signatures.other[other])
    }
    return missing.size > 0
  }

  // In the order the readings of the copies give them
  private build(): readonly Draft[] {
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
