import type { MergeResult } from '../../../types/mergeResult.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import type { IdentityTies } from './identity.js'
import type { Tuple } from './identityComponents.js'
import type { MergedReading } from './mergeReading.js'
import type { Reading } from './orderedEntry.js'
import type { Wrapped } from './orderedSides.js'
import {
  asResult,
  fewestSwapIndices,
  TieScan,
  trimmedBlock,
  wholeConflict,
} from './tieCombination.js'
import type { TieParts } from './tieParts.js'

interface Partwise {
  readonly wrapped: Wrapped
  readonly ties: IdentityTies
  readonly parts: TieParts
  readonly merge: (reading: Reading) => MergedReading
}

interface PartRound {
  readonly part: readonly number[]
  readonly merged: readonly MergedReading[]
  readonly survivors: readonly number[]
}

// Per tied part, its surviving choices merged around the first survivors (each
// tied part at its first surviving choice, every other stretch at the first
// tuple): the first survivors first, then with that part at each of its other
// surviving choices.
type Variations = readonly (readonly MergedReading[])[]

// around() orders a part's choices from its components alone, so a position
// names the same choice of the part around any base tuple.
const choiceAt = (
  ties: IdentityTies,
  part: readonly number[],
  base: Tuple,
  position: number
): Tuple => [...ties.around(part, base)][position]

// Each tied part at its first surviving choice, every other stretch as the
// first tuple.
const firstSurvivorsOf = (
  ties: IdentityTies,
  rounds: readonly PartRound[]
): Tuple =>
  rounds.reduce(
    (base, { part, survivors }) => choiceAt(ties, part, base, survivors[0]),
    ties.first
  )

const rendersAlike = (variations: Variations): boolean => {
  const [[firstSurvivors]] = variations
  return variations
    .flat()
    .every(reading => jsonIdentical(reading.output, firstSurvivors.output))
}

class PartwiseRun {
  private readonly scan = new TieScan()
  private readonly ties: IdentityTies

  constructor(private readonly input: Partwise) {
    this.ties = input.ties
  }

  mergeOf(tuple: Tuple): MergedReading {
    return this.input.merge(this.ties.readingOf(tuple))
  }

  record(readings: readonly MergedReading[]): void {
    for (const reading of readings) this.scan.add(reading)
  }

  // Every reading recorded belongs to the tie set, and the scan's decision
  // holds on any of its subsets. It is read between the rounds only: past
  // them, decided() answers the same conflict from the variations.
  isWholeConflict(): boolean {
    return this.scan.isWholeConflict()
  }

  // The part's first choice around the first tuple is the first tuple itself.
  roundOne(part: readonly number[], first: MergedReading): PartRound {
    const [, ...others] = this.ties.around(part, this.ties.first)
    const merged = others.map(tuple => this.mergeOf(tuple))
    this.record(merged)
    const all = [first, ...merged]
    return { part, merged: all, survivors: fewestSwapIndices(all) }
  }

  variations(rounds: readonly PartRound[]): Variations {
    if (rounds.every(({ survivors }) => survivors[0] === 0)) {
      return rounds.map(({ merged, survivors }) =>
        survivors.map(at => merged[at])
      )
    }
    const firstSurvivors = firstSurvivorsOf(this.ties, rounds)
    const firstSurvivorsMerged = this.mergeOf(firstSurvivors)
    return rounds.map(round =>
      this.aroundFirstSurvivors(round, firstSurvivors, firstSurvivorsMerged)
    )
  }

  // The one-part variations bound every survivor's ends: a cut's item stands
  // once in every output (OrderedSides: equal entries share a key, and a
  // cut's key is held once), so two survivors that differ in a part first
  // disagree inside it, where its variations already do.
  decided(variations: Variations): MergeResult {
    if (rendersAlike(variations)) return asResult(variations[0][0])
    const readings = variations.flat()
    if (readings.some(reading => reading.hasConflict)) {
      return wholeConflict(this.input.wrapped)
    }
    // The first survivors' output leads: every round's list starts with it
    return trimmedBlock(
      this.input.wrapped,
      readings.map(reading => reading.output)
    )
  }

  private aroundFirstSurvivors(
    round: PartRound,
    firstSurvivors: Tuple,
    firstSurvivorsMerged: MergedReading
  ): readonly MergedReading[] {
    const tuples = [...this.ties.around(round.part, firstSurvivors)]
    const [, ...others] = round.survivors
    const otherChoices = others.map(at => this.mergeOf(tuples[at]))
    return [firstSurvivorsMerged, ...otherChoices]
  }
}

export const mergePartwise = (input: Partwise): MergeResult => {
  const run = new PartwiseRun(input)
  const first = run.mergeOf(input.ties.first)
  run.record([first])
  const rounds: PartRound[] = []
  for (const part of input.parts.tied) {
    rounds.push(run.roundOne(part, first))
    if (run.isWholeConflict()) return wholeConflict(input.wrapped)
  }
  return run.decided(run.variations(rounds))
}
