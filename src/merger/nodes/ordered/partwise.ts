import type { JsonArray } from '../../../types/jsonTypes.js'
import type { MergeResult } from '../../../types/mergeResult.js'
import { leastOf } from '../../../utils/arrayUtils.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import { signatureOf } from '../../../utils/jsonSignature.js'
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

// Each tied part at the chosen position, every other stretch as the first
// tuple.
const withChoices = (
  ties: IdentityTies,
  rounds: readonly PartRound[],
  positionOf: (round: PartRound, at: number) => number
): Tuple =>
  rounds.reduce(
    (base, round, at) =>
      choiceAt(ties, round.part, base, positionOf(round, at)),
    ties.first
  )

const shortestAt = (readings: readonly MergedReading[]): number => {
  const lengths = readings.map(reading => reading.output.length)
  return lengths.indexOf(leastOf(lengths))
}

// Lengths add up over the parts: each at its shortest survivor gives the
// shortest survivor.
const shortestTuple = (
  ties: IdentityTies,
  rounds: readonly PartRound[],
  variations: Variations
): Tuple =>
  withChoices(
    ties,
    rounds,
    (round, at) => round.survivors[shortestAt(variations[at])]
  )

// A region item equal to a cut's would let two outputs agree across the cut,
// and the one-part variations would no longer bound every survivor's ends.
const holdsEachCutOnce = (
  output: JsonArray,
  cutItems: ReadonlySet<string>
): boolean => {
  const held = output
    .map(item => signatureOf(item))
    .filter(signature => cutItems.has(signature))
  return held.length === cutItems.size && new Set(held).size === held.length
}

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
  // holds on any of its subsets.
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
    const firstSurvivors = withChoices(
      this.ties,
      rounds,
      ({ survivors }) => survivors[0]
    )
    const firstSurvivorsMerged = this.mergeOf(firstSurvivors)
    this.record([firstSurvivorsMerged])
    return rounds.map(round =>
      this.aroundFirstSurvivors(round, firstSurvivors, firstSurvivorsMerged)
    )
  }

  decided(
    rounds: readonly PartRound[],
    variations: Variations
  ): MergeResult | null {
    if (rendersAlike(variations)) return asResult(variations[0][0])
    if (variations.flat().some(reading => reading.hasConflict)) {
      return wholeConflict(this.input.wrapped)
    }
    return this.stitched(rounds, variations)
  }

  private stitched(
    rounds: readonly PartRound[],
    variations: Variations
  ): MergeResult | null {
    // Nothing reads the scan past this point: the shortest reading is not
    // recorded
    const shortest = this.mergeOf(shortestTuple(this.ties, rounds, variations))
    // The first survivors' output leads: every round's list starts with it
    const outputs = [
      ...variations.flat().map(reading => reading.output),
      shortest.output,
    ]
    const { cutItems } = this.input.parts
    if (!outputs.every(output => holdsEachCutOnce(output, cutItems))) {
      return null
    }
    return trimmedBlock(this.input.wrapped, outputs)
  }

  private aroundFirstSurvivors(
    round: PartRound,
    firstSurvivors: Tuple,
    firstSurvivorsMerged: MergedReading
  ): readonly MergedReading[] {
    const tuples = [...this.ties.around(round.part, firstSurvivors)]
    const [, ...others] = round.survivors
    const otherChoices = others.map(at => this.mergeOf(tuples[at]))
    this.record(otherChoices)
    return [firstSurvivorsMerged, ...otherChoices]
  }
}

export const mergePartwise = (input: Partwise): MergeResult | null => {
  const run = new PartwiseRun(input)
  const first = run.mergeOf(input.ties.first)
  run.record([first])
  const rounds: PartRound[] = []
  for (const part of input.parts.tied) {
    rounds.push(run.roundOne(part, first))
    if (run.isWholeConflict()) return wholeConflict(input.wrapped)
  }
  const variations = run.variations(rounds)
  if (run.isWholeConflict()) return wholeConflict(input.wrapped)
  return run.decided(rounds, variations)
}
