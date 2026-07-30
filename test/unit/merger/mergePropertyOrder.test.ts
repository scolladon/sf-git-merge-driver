import { describe, expect, it } from 'vitest'
import { mergePropertyOrder } from '../../../src/merger/mergePropertyOrder.js'
import type { JsonObject } from '../../../src/types/jsonTypes.js'

// mergePropertyOrder resolves the *order* in which sibling XML tags are
// re-emitted after a three-way merge. It never decides which value wins —
// that stays with the node/strategy layer — only where each surviving key
// lands relative to its neighbours.
//
// Row 18 (`#text` residual): for A=[b], L=[b,z], O=[b,#text] the result is
// [b, #text, z] — `#text` is emitted before `z`. This is a KNOWN BOUNDED
// LIMITATION, not a bug: (1) what — a tag introduced on one side can land
// ahead of a `#text` that already existed on the ancestor's neighbour;
// (2) why bounded — it only surfaces when `#text` participates in a rank
// tie, and `#text`'s own UTF-16 rank (`#` = U+0023) makes it win that tie;
// (3) why not a regression — the shipped concat-dedup driver already
// placed `#text` asymmetrically depending on merge direction, so this
// trades one inconsistency for a different, deterministic one; (4) why not
// fixed here — real Salesforce metadata never mixes text content with
// child elements, and the parser has already collapsed and relocated any
// text runs into a single trailing `#text` key before this function ever
// runs, so the input shape this residual depends on does not occur in
// practice.

const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223
const LCG_MODULUS = 0xffffffff

// Hand-rolled seeded LCG — deterministic across CI runs, no new dependency
// for a single property-test file (the repo has no fast-check).
const createLcg = (seed: number): (() => number) => {
  let state = seed >>> 0
  return (): number => {
    state = (Math.imul(LCG_MULTIPLIER, state) + LCG_INCREMENT) >>> 0
    return state / LCG_MODULUS
  }
}

const KEY_POOL = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  '#text',
  '#xml__comment',
  '__cdata',
  '@_a',
]

const shuffled = (keys: string[], rng: () => number): string[] => {
  const copy = [...keys]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = copy[i]
    copy[i] = copy[j]
    copy[j] = swap
  }
  return copy
}

const randomKeyList = (rng: () => number): string[] => {
  const pool = shuffled(KEY_POOL, rng)
  const length = Math.floor(rng() * (pool.length + 1))
  return pool.slice(0, length)
}

const toObject = (keys: string[]): JsonObject =>
  Object.fromEntries(keys.map(key => [key, key]))

describe('mergePropertyOrder', () => {
  describe('fast path', () => {
    it('given identical key sequences on every side when mergePropertyOrder then returns the shared sequence', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given three empty objects when mergePropertyOrder then returns an empty array', () => {
      // Arrange & Act
      const sut = mergePropertyOrder({}, {}, {})

      // Assert
      expect(sut).toEqual([])
    })

    it('given an undefined ancestor and matching local/other sequences when mergePropertyOrder then returns the shared sequence', () => {
      // Arrange
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(undefined, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })
  })

  describe('isSubsequence branch', () => {
    it('given an ancestor that is a subsequence of matching local/other when mergePropertyOrder then returns the shared sequence', () => {
      // Arrange
      const ancestor = { a: 1 }
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given an ancestor edge that is not a subsequence of matching local/other when mergePropertyOrder then falls through to the general path', () => {
      // Arrange
      const ancestor = { x: 1, a: 2 }
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert — the ancestor edge x -> a still binds even though x is
      // dropped downstream
      expect(sut).toEqual(['x', 'a', 'b'])
    })
  })

  describe('sameSequence branch', () => {
    it('given local and other of different lengths when mergePropertyOrder then falls through to the general path', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { a: 1, b: 2, c: 3 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b', 'c'])
    })

    it('given local and other of equal length but different keys when mergePropertyOrder then falls through to the general path', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { a: 1, c: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b', 'c'])
    })
  })

  describe('general path — the bug fix (a key inserted mid-sequence is not pushed past the ancestor tail)', () => {
    it('given local inserting a key between two ancestor keys when mergePropertyOrder then keeps the inserted key between them', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, classAccesses: 2, tabSettings: 3 }
      const other = { description: 1, tabSettings: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['description', 'classAccesses', 'tabSettings'])
    })

    it('given other inserting the same key between the same two ancestor keys when mergePropertyOrder then returns the identical order (role symmetry)', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, tabSettings: 2 }
      const other = { description: 1, classAccesses: 2, tabSettings: 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['description', 'classAccesses', 'tabSettings'])
    })
  })

  describe('general path — tie-break on rank', () => {
    const expectedOrder = [
      'description',
      'classAccesses',
      'fieldPermissions',
      'tabSettings',
    ]

    it('given local and other each inserting a different key when mergePropertyOrder then the lexicographically smaller tied key comes first', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, fieldPermissions: 2, tabSettings: 3 }
      const other = { description: 1, classAccesses: 2, tabSettings: 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(expectedOrder)
    })

    it('given the same scenario with local and other swapped when mergePropertyOrder then returns the same order (role symmetry)', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, classAccesses: 2, tabSettings: 3 }
      const other = { description: 1, fieldPermissions: 2, tabSettings: 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert — same result value as the un-swapped case, not a re-typed
      // literal, so an ours-bias regression fails on this symmetry check
      expect(sut).toEqual(expectedOrder)
    })
  })

  describe('general path — cycle repair', () => {
    const expectedOrder = [
      'description',
      'applicationVisibilities',
      'fieldPermissions',
      'classAccesses',
      'tabSettings',
    ]

    it('given local and other each inserting a distinct chain of new keys when mergePropertyOrder then resolves the resulting rank cycle deterministically', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = {
        description: 1,
        fieldPermissions: 2,
        classAccesses: 3,
        tabSettings: 4,
      }
      const other = {
        description: 1,
        classAccesses: 2,
        applicationVisibilities: 3,
        fieldPermissions: 4,
        tabSettings: 5,
      }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(expectedOrder)
    })

    it('given the same scenario with local and other swapped when mergePropertyOrder then returns the same order (role symmetry)', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = {
        description: 1,
        classAccesses: 2,
        applicationVisibilities: 3,
        fieldPermissions: 4,
        tabSettings: 5,
      }
      const other = {
        description: 1,
        fieldPermissions: 2,
        classAccesses: 3,
        tabSettings: 4,
      }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(expectedOrder)
    })
  })

  describe('general path — totality', () => {
    it('given a key dropped by both local and other when mergePropertyOrder then still emits every surviving key exactly once', () => {
      // Arrange
      const ancestor = { description: 1, userLicense: 2, tabSettings: 3 }
      const local = { description: 1, tabSettings: 2 }
      const other = { description: 1, classAccesses: 2, tabSettings: 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert — userLicense is dropped further downstream by
      // combineResults; it must not be resurrected here nor duplicated
      expect(sut).toEqual([
        'description',
        'classAccesses',
        'userLicense',
        'tabSettings',
      ])
    })
  })

  describe('general path — pure rank (fully disjoint sides)', () => {
    it('given ancestor, local and other with no keys in common when mergePropertyOrder then orders by rank subject only to each side own edges', () => {
      // Arrange
      const ancestor = { x: 1 }
      const local = { l1: 1, l2: 2 }
      const other = { o1: 1, o2: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['l1', 'l2', 'o1', 'o2', 'x'])
    })
  })

  describe('array narrowing', () => {
    it('given a JsonArray on one side when mergePropertyOrder then that side contributes no keys', () => {
      // Arrange
      const ancestor = {}
      const local = ['x', 'y']
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given JsonArrays on every side when mergePropertyOrder then returns an empty array', () => {
      // Arrange
      const ancestor: string[] = ['a']
      const local: string[] = ['b', 'c']
      const other: string[] = ['d']

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual([])
    })
  })

  describe('attributes and sentinel keys', () => {
    it('given an attribute and #text alongside a newly inserted child when mergePropertyOrder then keeps the insertion between them without special-casing either sentinel', () => {
      // Arrange
      const ancestor = { '@_a': 1, child: 2, '#text': 3 }
      const local = { '@_a': 1, child: 2, newChild: 3, '#text': 4 }
      const other = { '@_a': 1, child: 2, '#text': 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['@_a', 'child', 'newChild', '#text'])
    })
  })

  describe('2-cycle repair', () => {
    it('given one side reordering two ancestor keys when mergePropertyOrder then does not preserve the reorder', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { b: 1, a: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert — documents the one capability traded away: pure reordering
      // is not preserved, matching the shipped driver's own behaviour so
      // nothing regresses
      expect(sut).toEqual(['a', 'b'])
    })
  })

  describe('#text accepted residual', () => {
    it('given #text entering a rank tie against a newly inserted key when mergePropertyOrder then #text is emitted first (the accepted residual, not a bug — see file header)', () => {
      // Arrange
      const ancestor = { b: 1 }
      const local = { b: 1, z: 2 }
      const other = { b: 1, '#text': 2 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['b', '#text', 'z'])
    })
  })

  describe('property lens', () => {
    const RANDOM_CASE_COUNT = 500

    it('given randomised key sequences when mergePropertyOrder then the result is a permutation of the key union', () => {
      // Arrange
      const rng = createLcg(1)

      for (let i = 0; i < RANDOM_CASE_COUNT; i++) {
        const ancestorKeys = randomKeyList(rng)
        const localKeys = randomKeyList(rng)
        const otherKeys = randomKeyList(rng)

        // Act
        const sut = mergePropertyOrder(
          toObject(ancestorKeys),
          toObject(localKeys),
          toObject(otherKeys)
        )

        // Assert
        const union = new Set([...ancestorKeys, ...localKeys, ...otherKeys])
        expect([...sut].sort()).toEqual([...union].sort())
      }
    })

    it('given randomised key sequences when mergePropertyOrder is invoked twice on the same inputs then the results are identical', () => {
      // Arrange
      const rng = createLcg(2)

      for (let i = 0; i < RANDOM_CASE_COUNT; i++) {
        const ancestor = toObject(randomKeyList(rng))
        const local = toObject(randomKeyList(rng))
        const other = toObject(randomKeyList(rng))

        // Act
        const first = mergePropertyOrder(ancestor, local, other)
        const second = mergePropertyOrder(ancestor, local, other)

        // Assert
        expect(second).toEqual(first)
      }
    })

    it('given randomised key sequences when local and other are swapped then mergePropertyOrder returns the same order', () => {
      // Arrange
      const rng = createLcg(3)

      for (let i = 0; i < RANDOM_CASE_COUNT; i++) {
        const ancestor = toObject(randomKeyList(rng))
        const local = toObject(randomKeyList(rng))
        const other = toObject(randomKeyList(rng))

        // Act
        const forward = mergePropertyOrder(ancestor, local, other)
        const swapped = mergePropertyOrder(ancestor, other, local)

        // Assert
        expect(swapped).toEqual(forward)
      }
    })
  })
})
