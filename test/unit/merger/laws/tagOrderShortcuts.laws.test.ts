import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ContestedTagOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'
import {
  generalKeyOrder,
  mergeKeyOrder,
  mergePropertyOrder,
} from '../../../../src/merger/tagOrder/mergePropertyOrder.js'
import { TagOrderCache } from '../../../../src/merger/tagOrder/tagOrderCache.js'

// The shortcuts of the child-tag order merge and its cache are optimisations:
// whatever they answer, the general merge answers too.

const TAGS = ['a', 'b', 'c', 'd', 'e']
const MAX_TRIPLES = 12

type Sequence = string[]
type Triple = readonly [Sequence, Sequence, Sequence]

const sequenceArb: fc.Arbitrary<Sequence> = fc.shuffledSubarray(TAGS)

const independentTriple: fc.Arbitrary<Triple> = fc.tuple(
  sequenceArb,
  sequenceArb,
  sequenceArb
)

// One side kept the ancestor's sequence; the other side rewrote it, keeping
// every ancestor tag (the shortcut) or dropping some (what it must refuse)
const oneSidedTriple: fc.Arbitrary<Triple> = fc
  .tuple(sequenceArb, sequenceArb, fc.boolean())
  .map(([ancestor, rewritten, localRewrites]) =>
    localRewrites
      ? ([ancestor, rewritten, ancestor] as const)
      : ([ancestor, ancestor, rewritten] as const)
  )

// The rewrite holds every ancestor tag, moved and surrounded by new ones
const coveringTriple: fc.Arbitrary<Triple> = fc
  .tuple(sequenceArb, fc.boolean())
  .chain(([ancestor, localRewrites]) =>
    fc
      .shuffledSubarray(TAGS, { minLength: ancestor.length })
      .map(extended => [...new Set([...ancestor, ...extended])])
      .chain(superset =>
        fc.shuffledSubarray(superset, { minLength: superset.length })
      )
      .map(rewritten =>
        localRewrites
          ? ([ancestor, rewritten, ancestor] as const)
          : ([ancestor, ancestor, rewritten] as const)
      )
  )

const tripleArb = fc.oneof(independentTriple, oneSidedTriple, coveringTriple)

const objectOf = (sequence: Sequence): Record<string, string> =>
  Object.fromEntries(sequence.map(tag => [tag, 'v']))

const equalsTheGeneralMerge = fc.property(tripleArb, ([a, l, o]) => {
  // Act
  const sut = mergeKeyOrder(a, l, o)

  // Assert
  expect(sut).toEqual(generalKeyOrder(a, l, o))
})

const POLICIES = [ContestedTagOrder.CONFLICT, ContestedTagOrder.CANONICAL]

const cachedEqualsUncached = fc.property(
  fc.array(tripleArb, { minLength: 1, maxLength: MAX_TRIPLES }),
  triples => {
    // Arrange
    const cache = new TagOrderCache()
    const asked = [...triples, ...triples].flatMap(([a, l, o]) =>
      POLICIES.map(policy => ({ policy, a, l, o }))
    )

    for (const { policy, a, l, o } of asked) {
      // Act
      const sut = mergePropertyOrder(
        objectOf(a),
        objectOf(l),
        objectOf(o),
        policy,
        cache
      )

      // Assert
      expect(sut).toEqual(
        mergePropertyOrder(objectOf(a), objectOf(l), objectOf(o), policy)
      )
    }
  }
)

describe('JsonMerger laws: child-tag order shortcuts', () => {
  it('when merging key sequences then the shortcuts answer what the general merge answers', () => {
    fc.assert(equalsTheGeneralMerge)
  })

  it('when a cache serves the merges then each answer is the uncached one, under either policy', () => {
    fc.assert(cachedEqualsUncached)
  })

  it('when sampled then a one-sided rewrite that drops a tag is reached often', () => {
    // Arrange
    const samples = fc.sample(oneSidedTriple, 400)

    // Act
    const dropping = samples.filter(([a, l, o]) => {
      const rewritten = l === a ? o : l
      return a.some(tag => !rewritten.includes(tag))
    })

    // Assert
    expect(dropping.length / samples.length).toBeGreaterThan(0.2)
  })
})
