import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  fewestMoves,
  type Point,
  type PointSet,
} from '../../../../../src/merger/nodes/ordered/identityComponents.js'
import { lisLength } from '../../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  LIVE_SIDES,
  type LiveSide,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'

type Pair = readonly [ancestor: number, position: number]

const pointsOf = (pairs: readonly Pair[]): readonly Point[] =>
  pairs.map(([ancestor, position]) => ({ ancestor, position }))

const alternative = (
  local: readonly Pair[],
  other: readonly Pair[] = []
): PointSet => ({ local: pointsOf(local), other: pointsOf(other) })

const NO_POINTS = alternative([])

const movesOnSide = (points: readonly Point[]): number =>
  points.length -
  lisLength(
    [...points]
      .sort((left, right) => left.ancestor - right.ancestor)
      .map(point => point.position)
  )

const movesOfTuple = (
  stretches: readonly (readonly PointSet[])[],
  tuple: readonly number[]
): number =>
  LIVE_SIDES.reduce(
    (total, side) =>
      total +
      movesOnSide(
        tuple.flatMap((choice, at) => stretches[at][choice][side] as Point[])
      ),
    0
  )

function* lexicographicTuples(
  sizes: readonly number[]
): Generator<readonly number[]> {
  if (sizes.length === 0) {
    yield []
    return
  }
  for (let first = 0; first < sizes[0]; first++) {
    for (const rest of lexicographicTuples(sizes.slice(1))) {
      yield [first, ...rest]
    }
  }
}

const bruteForce = (
  stretches: readonly (readonly PointSet[])[]
): readonly (readonly number[])[] => {
  const tuples = [...lexicographicTuples(stretches.map(s => s.length))]
  const costs = tuples.map(tuple => movesOfTuple(stretches, tuple))
  const least = Math.min(...costs)
  return tuples.filter((_, at) => costs[at] === least)
}

const MAX_STRETCHES = 5
const MAX_ALTERNATIVES = 3
const MAX_SLOTS_PER_AXIS = 3

type Axis = 'ancestor' | LiveSide

interface Owned {
  readonly ancestor: readonly number[]
  readonly local: readonly number[]
  readonly other: readonly number[]
  readonly alternatives: number
}

const slotsPerStretch = fc.array(
  fc.record({
    ancestor: fc.nat(MAX_SLOTS_PER_AXIS),
    local: fc.nat(MAX_SLOTS_PER_AXIS),
    other: fc.nat(MAX_SLOTS_PER_AXIS),
    alternatives: fc.integer({ min: 1, max: MAX_ALTERNATIVES }),
  }),
  { minLength: 1, maxLength: MAX_STRETCHES }
)

const sum = (counts: readonly number[]): number =>
  counts.reduce((total, count) => total + count, 0)

// One random permutation of the axis slots, dealt in chunks: the stretches
// interleave on every axis.
const dealt = (
  counts: readonly number[],
  order: readonly number[]
): readonly (readonly number[])[] =>
  counts.map((count, at) => {
    const from = sum(counts.slice(0, at))
    return order.slice(from, from + count)
  })

const permutation = (size: number): fc.Arbitrary<readonly number[]> =>
  fc.shuffledSubarray(
    Array.from({ length: size }, (_, at) => at),
    { minLength: size, maxLength: size }
  )

const ownedSlots = (
  counts: readonly Record<Axis | 'alternatives', number>[]
): fc.Arbitrary<readonly Owned[]> =>
  fc
    .tuple(
      ...(['ancestor', 'local', 'other'] as const).map(axis =>
        permutation(sum(counts.map(count => count[axis])))
      )
    )
    .map(([ancestors, locals, others]) => {
      const byAxis = {
        ancestor: dealt(
          counts.map(count => count.ancestor),
          ancestors
        ),
        local: dealt(
          counts.map(count => count.local),
          locals
        ),
        other: dealt(
          counts.map(count => count.other),
          others
        ),
      }
      return counts.map((count, at) => ({
        ancestor: byAxis.ancestor[at],
        local: byAxis.local[at],
        other: byAxis.other[at],
        alternatives: count.alternatives,
      }))
    })

// An injective partial map: the first pair on an ancestor or a slot wins.
const injective = (pairs: readonly Pair[]): readonly Pair[] => {
  const ancestors = new Set<number>()
  const slots = new Set<number>()
  return pairs.filter(([ancestor, slot]) => {
    if (ancestors.has(ancestor) || slots.has(slot)) return false
    ancestors.add(ancestor)
    slots.add(slot)
    return true
  })
}

const pairsBetween = (
  ancestors: readonly number[],
  slots: readonly number[]
): fc.Arbitrary<readonly Pair[]> =>
  ancestors.length === 0 || slots.length === 0
    ? fc.constant([])
    : fc
        .array(
          fc.tuple(fc.constantFrom(...ancestors), fc.constantFrom(...slots)),
          { maxLength: MAX_SLOTS_PER_AXIS }
        )
        .map(injective)

const alternativesOf = (owned: Owned): fc.Arbitrary<readonly PointSet[]> =>
  fc.array(
    fc
      .tuple(
        pairsBetween(owned.ancestor, owned.local),
        pairsBetween(owned.ancestor, owned.other)
      )
      .map(([local, other]) => alternative(local, other)),
    { minLength: owned.alternatives, maxLength: owned.alternatives }
  )

const stretchesArb: fc.Arbitrary<readonly (readonly PointSet[])[]> =
  slotsPerStretch
    .chain(ownedSlots)
    .chain(owned => fc.tuple(...owned.map(alternativesOf)))

describe('fewestMoves', () => {
  describe('given two stretches split by a fixed point', () => {
    describe('when choosing', () => {
      it('then each keeps its tied alternatives and the result is their product in order', () => {
        // Arrange
        const stretches = [
          [
            alternative([
              [0, 0],
              [1, 1],
            ]),
            alternative([[0, 0]]),
          ],
          [alternative([[2, 2]])],
          [
            alternative([
              [3, 3],
              [4, 4],
            ]),
            alternative([[3, 3]]),
          ],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([
          [0, 0, 0],
          [0, 0, 1],
          [1, 0, 0],
          [1, 0, 1],
        ])
      })
    })
  })

  describe('given two keys whose copies interleave', () => {
    describe('when choosing', () => {
      it('then they are chosen together', () => {
        // Arrange
        const straightA = alternative([
          [0, 0],
          [2, 2],
        ])
        const crossedA = alternative([
          [0, 2],
          [2, 0],
        ])
        const straightB = alternative([
          [1, 1],
          [3, 3],
        ])
        const crossedB = alternative([
          [1, 3],
          [3, 1],
        ])

        // Act
        const result = fewestMoves([
          [straightA, crossedA],
          [straightB, crossedB],
        ])

        // Assert
        expect(result).toEqual([[0, 0]])
      })
    })
  })

  describe('given a fixed point inside a key gap', () => {
    describe('when choosing', () => {
      it('then it counts in the key moves', () => {
        // Arrange
        const stretches = [
          [
            alternative([
              [0, 0],
              [2, 2],
            ]),
            alternative([[0, 2]]),
          ],
          [alternative([[1, 1]])],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([[0, 0]])
      })
    })
  })

  describe('given an alternative leaving a gap that another fills', () => {
    describe('when choosing', () => {
      it('then the empty one avoids the moves of the filled one', () => {
        // Arrange
        const stretches = [
          [alternative([[0, 2]]), NO_POINTS],
          [alternative([[1, 1]])],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([[1, 0]])
      })
    })
  })

  describe('given two keys sharing a gap whose choices all cost the same', () => {
    describe('when choosing', () => {
      it('then every combination is listed in order', () => {
        // Arrange
        const keyA = [
          [0, 0],
          [2, 2],
        ] as const
        const keyB = [
          [1, 1],
          [3, 3],
        ] as const

        // Act
        const result = fewestMoves([
          [alternative(keyA), alternative(keyA)],
          [alternative(keyB), alternative(keyB)],
        ])

        // Assert
        expect(result).toEqual([
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ])
      })
    })
  })

  describe('given a stretch with no point on either side', () => {
    describe('when choosing', () => {
      it('then all its alternatives stay', () => {
        // Arrange
        const stretches = [
          [NO_POINTS, NO_POINTS, NO_POINTS],
          [alternative([[0, 0]])],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([
          [0, 0],
          [1, 0],
          [2, 0],
        ])
      })
    })
  })

  describe('given keys crossing on the other side only', () => {
    describe('when choosing', () => {
      it('then they are chosen together there too', () => {
        // Arrange
        const straightA = alternative(
          [],
          [
            [0, 0],
            [2, 2],
          ]
        )
        const crossedA = alternative(
          [],
          [
            [0, 2],
            [2, 0],
          ]
        )
        const straightB = alternative(
          [],
          [
            [1, 1],
            [3, 3],
          ]
        )
        const crossedB = alternative(
          [],
          [
            [1, 3],
            [3, 1],
          ]
        )

        // Act
        const result = fewestMoves([
          [crossedA, straightA],
          [crossedB, straightB],
        ])

        // Assert
        expect(result).toEqual([[1, 1]])
      })
    })
  })

  describe('given alternatives moving on different sides', () => {
    describe('when choosing', () => {
      it('then moves on both sides add up', () => {
        // Arrange
        const crossing = [
          [0, 1],
          [1, 0],
        ] as const
        const straight = [
          [0, 0],
          [1, 1],
        ] as const
        const stretches = [
          [
            alternative(crossing, crossing),
            alternative(straight, crossing),
            alternative(crossing, straight),
          ],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([[1], [2]])
      })
    })
  })

  describe('given every stretch fixed', () => {
    describe('when choosing', () => {
      it('then the one choice is the first alternative of each', () => {
        // Arrange
        const stretches = [
          [
            alternative([
              [0, 1],
              [1, 0],
            ]),
          ],
          [alternative([[2, 2]])],
        ]

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([[0, 0]])
      })
    })
  })

  describe('given no stretch', () => {
    describe('when choosing', () => {
      it('then the one choice is empty', () => {
        // Arrange
        const stretches: readonly (readonly PointSet[])[] = []

        // Act
        const result = fewestMoves(stretches)

        // Assert
        expect(result).toEqual([[]])
      })
    })
  })

  describe('given stretches whose slots interleave', () => {
    describe('when choosing', () => {
      it('then the tuples equal the brute force, in order', () => {
        fc.assert(
          fc.property(stretchesArb, stretches => {
            // Arrange
            const expected = bruteForce(stretches)

            // Act
            const result = fewestMoves(stretches)

            // Assert
            expect(result).toEqual(expected)
          })
        )
      })
    })
  })
})
