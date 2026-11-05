import type { MergeResult } from '../../../types/mergeResult.js'
import { jsonIdentical } from '../../../utils/jsonEqual.js'
import type { IdentityTies } from './identity.js'
import type { Tuple } from './identityComponents.js'
import type { MergedReading } from './mergeOrdered.js'
import type { Reading } from './orderedEntry.js'
import {
  asResult,
  TieScan,
  type Wrapped,
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

// Per tied part, the merged readings of V: s* first, then s* with that part at
// each of its other surviving choices.
type Variations = readonly (readonly MergedReading[])[]

const fewestAt = (merged: readonly MergedReading[]): readonly number[] => {
  const swaps = merged.map(reading => reading.phantomSwaps())
  const least = Math.min(...swaps)
  return swaps.flatMap((count, at) => (count === least ? [at] : []))
}

// around() orders a part's choices from its components alone, so a position
// names the same choice of the part around any base tuple.
const choiceAt = (
  ties: IdentityTies,
  part: readonly number[],
  base: Tuple,
  position: number
): Tuple => [...ties.around(part, base)][position]

// Each tied part at the chosen position, every other stretch as the first tuple.
const withChoices = (
  ties: IdentityTies,
  rounds: readonly PartRound[],
  positionOf: (round: PartRound) => number
): Tuple =>
  rounds.reduce(
    (base, round) => choiceAt(ties, round.part, base, positionOf(round)),
    ties.first
  )

const rendersAlike = (variations: Variations): boolean => {
  const [[star]] = variations
  return variations
    .flat()
    .every(reading => jsonIdentical(reading.output, star.output))
}

class PartwiseRun {
  private readonly scan = new TieScan()

  constructor(private readonly input: Partwise) {}

  merged(tuple: Tuple): MergedReading {
    const reading = this.input.merge(this.input.ties.readingOf(tuple))
    this.scan.add(reading)
    return reading
  }

  // Every reading merged here belongs to the tie set, and the scan's decision
  // holds on any of its subsets.
  isWholeConflict(): boolean {
    return this.scan.isWholeConflict()
  }

  // The part's first choice around the first tuple is the first tuple itself.
  roundOne(part: readonly number[], first: MergedReading): PartRound {
    const [, ...others] = this.input.ties.around(part, this.input.ties.first)
    const merged = [first, ...others.map(tuple => this.merged(tuple))]
    return { part, merged, survivors: fewestAt(merged) }
  }

  variations(rounds: readonly PartRound[]): Variations {
    if (rounds.every(({ survivors }) => survivors[0] === 0)) {
      return rounds.map(({ merged, survivors }) =>
        survivors.map(at => merged[at])
      )
    }
    const star = withChoices(
      this.input.ties,
      rounds,
      ({ survivors }) => survivors[0]
    )
    const starMerged = this.merged(star)
    return rounds.map(round => this.aroundStar(round, star, starMerged))
  }

  decided(variations: Variations): MergeResult | null {
    if (rendersAlike(variations)) return asResult(variations[0][0])
    if (variations.flat().some(reading => reading.hasConflict)) {
      return wholeConflict(this.input.wrapped)
    }
    // Survivors that differ without conflict: the stream builds their block.
    return null
  }

  private aroundStar(
    round: PartRound,
    star: Tuple,
    starMerged: MergedReading
  ): readonly MergedReading[] {
    const tuples = [...this.input.ties.around(round.part, star)]
    const [, ...others] = round.survivors
    return [starMerged, ...others.map(at => this.merged(tuples[at]))]
  }
}

export const mergePartwise = (input: Partwise): MergeResult | null => {
  const run = new PartwiseRun(input)
  const first = run.merged(input.ties.first)
  const rounds: PartRound[] = []
  for (const part of input.parts.tied) {
    rounds.push(run.roundOne(part, first))
    if (run.isWholeConflict()) return wholeConflict(input.wrapped)
  }
  const variations = run.variations(rounds)
  if (run.isWholeConflict()) return wholeConflict(input.wrapped)
  return run.decided(variations)
}
