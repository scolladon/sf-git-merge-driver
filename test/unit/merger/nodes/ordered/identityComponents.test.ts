import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import {
  firstChoice,
  isTied,
  type Point,
  type PointSet,
  projected,
  type TieComponent,
  type Tuple,
  tieComponents,
  walkAround,
} from '../../../../../src/merger/nodes/ordered/identityComponents.js'
import { lisLength } from '../../../../../src/merger/nodes/ordered/orderAxis.js'
import {
  LIVE_SIDES,
  type LiveSide,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import {
  tieComponents as referenceComponents,
  isTied as referenceIsTied,
} from '../../../../utils/oracles/draftIdentity/identityComponents.js'

vi.mock(
  '../../../../../src/merger/nodes/ordered/orderAxis.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/nodes/ordered/orderAxis.js')
      >()
    return { ...original, lisLength: vi.fn(original.lisLength) }
  }
)

// The whole walk: every component from its least tuple.
const fewestMoves = (
  stretches: readonly (readonly PointSet[])[]
): Iterable<Tuple> => {
  const components = tieComponents(stretches)
  return walkAround(components, firstChoice(stretches.length, components))
}

type Pair = readonly [ancestor: number, position: number]

const pointsOf = (pairs: readonly Pair[]): readonly Point[] =>
  pairs.map(([ancestor, position]) => ({ ancestor, position }))

const alternative = (
  local: readonly Pair[],
  other: readonly Pair[] = []
): PointSet => {
  const points = { local: pointsOf(local), other: pointsOf(other) }
  return side => points[side]
}

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
      movesOnSide(tuple.flatMap((choice, at) => stretches[at][choice](side))),
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
        const result = [...fewestMoves(stretches)]

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
        const result = [
          ...fewestMoves([
            [straightA, crossedA],
            [straightB, crossedB],
          ]),
        ]

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
        const result = [...fewestMoves(stretches)]

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
        const result = [...fewestMoves(stretches)]

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
        const result = [
          ...fewestMoves([
            [alternative(keyA), alternative(keyA)],
            [alternative(keyB), alternative(keyB)],
          ]),
        ]

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
        const result = [...fewestMoves(stretches)]

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
        const result = [
          ...fewestMoves([
            [crossedA, straightA],
            [crossedB, straightB],
          ]),
        ]

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
        const result = [...fewestMoves(stretches)]

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
        const result = [...fewestMoves(stretches)]

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
        const result = [...fewestMoves(stretches)]

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
            const result = [...fewestMoves(stretches)]

            // Assert
            expect(result).toEqual(expected)
          })
        )
      })
    })
  })
})

const SPLIT_PLANE = [
  [alternative([[0, 0]]), alternative([[1, 0]])],
  [alternative([[2, 1]]), alternative([[3, 1]])],
]

const CROSSING_PLANE = [
  [alternative([[0, 1]]), alternative([[1, 1]])],
  [alternative([[2, 0]]), alternative([[3, 0]])],
]

const SPLIT_ON_LOCAL_CROSSING_ON_OTHER = [
  [alternative([[0, 0]], [[0, 1]]), alternative([[1, 0]], [[1, 1]])],
  [alternative([[2, 1]], [[2, 0]]), alternative([[3, 1]], [[3, 0]])],
]

const ONE_COMPONENT = [
  {
    members: [0, 1],
    minimal: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
]

const membersAndMinima = (
  stretches: readonly (readonly PointSet[])[]
): readonly { members: readonly number[]; minimal: readonly Tuple[] }[] =>
  tieComponents(stretches).map(({ members, minimal }) => ({
    members,
    minimal,
  }))

describe('tieComponents', () => {
  describe('given two tied stretches whose points all lie below one another on both positions', () => {
    describe('when taking their components', () => {
      it('then each stretch is a component with both of its tuples', () => {
        // Arrange
        const sut = SPLIT_PLANE

        // Act
        const result = membersAndMinima(sut)

        // Assert
        expect(result).toEqual([
          {
            members: [0],
            minimal: [[0], [1]],
          },
          {
            members: [1],
            minimal: [[0], [1]],
          },
        ])
      })
    })

    describe('when walking every choice', () => {
      it('then the tuples are the product in lexicographic order', () => {
        // Arrange
        const sut = SPLIT_PLANE

        // Act
        const result = [...fewestMoves(sut)]

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

  describe('given two tied stretches whose points cross on both positions', () => {
    describe('when taking their components', () => {
      it('then the stretches stay one component', () => {
        // Arrange
        const sut = CROSSING_PLANE

        // Act
        const result = membersAndMinima(sut)

        // Assert
        expect(result).toEqual(ONE_COMPONENT)
      })
    })
  })

  describe('given two tied stretches below one another on local and crossing on other', () => {
    describe('when taking their components', () => {
      it('then the other side keeps them one component', () => {
        // Arrange
        const sut = SPLIT_ON_LOCAL_CROSSING_ON_OTHER

        // Act
        const result = membersAndMinima(sut)

        // Assert
        expect(result).toEqual(ONE_COMPONENT)
      })
    })
  })
})

describe('tieComponents gaps', () => {
  const gapsPerComponent = (
    stretches: readonly (readonly PointSet[])[]
  ): readonly number[] =>
    tieComponents(stretches).map(({ labels }) => labels.length)

  describe('given a fixed stretch standing in a gap on each of two sides', () => {
    describe('when taking the components of the tied stretches around it', () => {
      it('then they stay apart: the fixed stretch moves no cost between them', () => {
        // Arrange
        const sut = [
          [alternative([], [[0, 2]]), alternative([], [[0, 3]])],
          [
            alternative([
              [1, 0],
              [3, 2],
            ]),
            alternative([[1, 2]]),
          ],
          [alternative([[5, 1]], [[5, 0]])],
        ]

        // Act
        const result = membersAndMinima(sut)

        // Assert
        expect(result).toEqual([
          { members: [0], minimal: [[0], [1]] },
          { members: [1], minimal: [[0], [1]] },
        ])
      })
    })
  })

  describe('given alternatives of one entry landing on different positions', () => {
    describe('when counting the gaps of the stretch', () => {
      it('then it spans one gap: the alternatives are never present together', () => {
        // Arrange
        const sut = [[alternative([[0, 0]]), alternative([[0, 1]])]]

        // Act
        const result = gapsPerComponent(sut)

        // Assert
        expect(result).toEqual([1])
      })
    })
  })

  describe('given alternatives of different entries landing on one position', () => {
    describe('when counting the gaps of the stretch', () => {
      it('then it spans one gap: the position is not strictly above the first', () => {
        // Arrange
        const sut = [[alternative([[0, 0]]), alternative([[1, 0]])]]

        // Act
        const result = gapsPerComponent(sut)

        // Assert
        expect(result).toEqual([1])
      })
    })
  })

  describe('given alternatives with points on both sides', () => {
    describe('when counting the gaps of the stretch', () => {
      it('then it spans one gap per side', () => {
        // Arrange
        const sut = [
          [alternative([[0, 0]], [[0, 0]]), alternative([[0, 1]], [[0, 1]])],
        ]

        // Act
        const result = gapsPerComponent(sut)

        // Assert
        expect(result).toEqual([2])
      })
    })
  })
})

describe('isTied', () => {
  const componentOf = (minimal: readonly Tuple[]): TieComponent => ({
    members: [0],
    labels: [],
    sizes: [2],
    minimal,
  })

  describe('given a component left two fewest-move tuples', () => {
    describe('when asking whether it is tied', () => {
      it('then it is', () => {
        // Arrange
        const sut = componentOf([[0], [1]])

        // Act
        const result = isTied(sut)

        // Assert
        expect(result).toBe(true)
      })
    })
  })

  describe('given a component left one fewest-move tuple', () => {
    describe('when asking whether it is tied', () => {
      it('then it is not', () => {
        // Arrange
        const sut = componentOf([[0]])

        // Act
        const result = isTied(sut)

        // Assert
        expect(result).toBe(false)
      })
    })
  })
})

describe('projected', () => {
  const componentOf = (
    members: readonly number[],
    minimal: readonly Tuple[]
  ): TieComponent => ({
    members,
    labels: [],
    sizes: members.map(() => 1 + Math.max(...minimal.flat())),
    minimal,
  })

  describe('given tuples agreeing on the kept stretches', () => {
    describe('when projecting on those stretches', () => {
      it('then each choice of the kept ones stays at its first tuple, in order', () => {
        // Arrange
        const sut = componentOf(
          [0, 1, 2],
          [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 0],
            [1, 0, 0],
          ]
        )

        // Act
        const result = projected(sut, stretch => stretch !== 1)

        // Assert
        expect(result.minimal).toEqual([
          [0, 0, 0],
          [0, 0, 1],
          [1, 0, 0],
        ])
      })
    })
  })

  describe('given kept choices whose digits run together', () => {
    describe('when projecting on every stretch', () => {
      it('then both tuples stay: 1 then 12 is not 11 then 2', () => {
        // Arrange
        const sut = componentOf(
          [0, 1],
          [
            [1, 12],
            [11, 2],
          ]
        )

        // Act
        const result = projected(sut, () => true)

        // Assert
        expect(result.minimal).toEqual([
          [1, 12],
          [11, 2],
        ])
      })
    })
  })
})

describe('walkAround', () => {
  describe('given two tied stretches split by a fixed one', () => {
    const TWO_TIED_STRETCHES = [
      [
        alternative(
          [[0, 0]],
          [
            [0, 0],
            [1, 1],
          ]
        ),
        alternative(
          [[1, 0]],
          [
            [0, 0],
            [1, 1],
          ]
        ),
      ],
      [alternative([[2, 1]], [[2, 2]])],
      [
        alternative(
          [[3, 2]],
          [
            [3, 3],
            [4, 4],
          ]
        ),
        alternative(
          [[4, 2]],
          [
            [3, 3],
            [4, 4],
          ]
        ),
      ],
    ]

    describe('when taking their components', () => {
      it('then each holds one stretch with both of its tuples, and the first choice takes the least', () => {
        // Arrange
        const sut = tieComponents(TWO_TIED_STRETCHES)

        // Act
        const result = sut.map(({ members, minimal }) => ({ members, minimal }))

        // Assert
        expect(result).toEqual([
          { members: [0], minimal: [[0], [1]] },
          { members: [2], minimal: [[0], [1]] },
        ])
        expect(firstChoice(TWO_TIED_STRETCHES.length, sut)).toEqual([0, 0, 0])
      })
    })

    describe('when walking the first component around a base holding the other tuple of the second', () => {
      it('then every tuple keeps the choice of the base for the second', () => {
        // Arrange
        const components = tieComponents(TWO_TIED_STRETCHES)
        const base: Tuple = [0, 0, 1]

        // Act
        const result = [...walkAround([components[0]], base)]

        // Assert
        expect(result).toEqual([
          [0, 0, 1],
          [1, 0, 1],
        ])
      })
    })

    describe('when walking both from the first choice', () => {
      it('then the whole product comes in lexicographic order', () => {
        // Arrange
        const components = tieComponents(TWO_TIED_STRETCHES)
        const first = firstChoice(TWO_TIED_STRETCHES.length, components)

        // Act
        const result = [...walkAround(components, first)]

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
})

describe('tieComponents over shared points arrays', () => {
  // Alternative i takes local array i mod 2 and other array floor(i / 2) mod 2
  // of its stretch: the pairings repeat across alternatives, as a repeated
  // key's do.
  const SHARED_ARRAYS_PER_SIDE = 2

  const sharingSides = (alternatives: readonly PointSet[]): PointSet[] => {
    const locals = alternatives.map(set => set('local'))
    const others = alternatives.map(set => set('other'))
    return alternatives.map((_, at) => {
      const points = {
        local: locals[at % SHARED_ARRAYS_PER_SIDE],
        other:
          others[
            Math.floor(at / SHARED_ARRAYS_PER_SIDE) % SHARED_ARRAYS_PER_SIDE
          ],
      }
      return side => points[side]
    })
  }

  const freshCopies = (alternatives: readonly PointSet[]): PointSet[] =>
    alternatives.map(set => side => [...set(side)])

  describe('given stretches whose alternatives share points arrays per side', () => {
    describe('when the components are built', () => {
      it('then they equal the reference over fresh arrays', () => {
        fc.assert(
          fc.property(stretchesArb, stretches => {
            // Arrange
            const shared = stretches.map(sharingSides)
            const reference = referenceComponents(shared.map(freshCopies))

            // Act
            const sut = tieComponents(shared)

            // Assert
            expect(sut).toStrictEqual(reference)
            expect(sut.map(isTied)).toEqual(reference.map(referenceIsTied))
          })
        )
      })
    })
  })

  interface Counted {
    readonly array: readonly Point[]
    readonly traversals: { count: number }
  }

  // An array counting the passes that iterate it.
  const counted = (pairs: readonly Pair[]): Counted => {
    const points = [...pointsOf(pairs)]
    const traversals = { count: 0 }
    const iterate = points[Symbol.iterator].bind(points)
    points[Symbol.iterator] = () => {
      traversals.count++
      return iterate()
    }
    return { array: points, traversals }
  }

  describe('given four alternatives handing one local array', () => {
    describe('when the components are built', () => {
      it('then the array is read once per layout pass and once for the cost', () => {
        // Arrange
        // Read by the spans of the local side, by the gaps of the stretch, and
        // by the first tuple's local moves: the other tuples hand the same
        // array, whose moves are known.
        const READS = 3
        const { array: local, traversals } = counted([
          [0, 0],
          [1, 1],
        ])
        const sut = [0, 1, 2, 3].map(at => {
          const other = pointsOf([[at % 2, at]])
          const points = { local, other }
          return (side: LiveSide) => points[side]
        })

        // Act
        tieComponents([sut])

        // Assert
        expect(traversals.count).toBe(READS)
      })
    })
  })

  describe('given two alternatives with points on both sides', () => {
    describe('when the components are built', () => {
      it('then each side measures its own gap only', () => {
        // Arrange
        // One gap per side; each tuple measures its local gap and its other
        // gap once: two tuples, two measures each.
        const MEASURES = 4
        const sut = [
          [alternative([[0, 0]], [[0, 1]]), alternative([[0, 1]], [[0, 0]])],
        ]

        // Act
        tieComponents(sut)

        // Assert
        expect(lisLength).toHaveBeenCalledTimes(MEASURES)
      })
    })
  })
})
