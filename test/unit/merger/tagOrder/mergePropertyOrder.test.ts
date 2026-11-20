import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { mergePropertyOrder } from '../../../../src/merger/tagOrder/mergePropertyOrder.js'
import type { JsonObject } from '../../../../src/types/jsonTypes.js'

// mergePropertyOrder resolves the *order* in which sibling XML tags are
// re-emitted after a three-way merge. It never decides which value wins —
// that stays with the node/strategy layer — only where each surviving key
// lands relative to its neighbours.
//
// The '#text accepted residual' case below: for A=[b], L=[b,z], O=[b,#text]
// the result is [b, #text, z] — `#text` is emitted before `z`. This is a
// KNOWN BOUNDED LIMITATION, not a bug: (1) what — a tag introduced on one
// side can land ahead of a `#text` that already existed on the ancestor's
// neighbour; (2) why bounded — it only surfaces when `#text` participates
// in a rank tie, and `#text`'s own UTF-16 rank (`#` = U+0023) makes it win
// that tie; (3) why not a regression — the shipped concat-dedup driver
// already placed `#text` asymmetrically depending on merge direction, so
// this trades one inconsistency for a different, deterministic one; (4)
// why not fixed here — real Salesforce metadata never mixes text content
// with child elements, and the parser has already collapsed and relocated
// any text runs into a single trailing `#text` key before this function
// ever runs, so the input shape this residual depends on does not occur
// in practice.

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

const keyList = fc.shuffledSubarray(KEY_POOL)
const keyTrio = fc.tuple(keyList, keyList, keyList)

const toObject = (keys: string[]): JsonObject =>
  Object.fromEntries(keys.map(key => [key, key]))

// Independent oracle for the 4th property: derives the same kind of
// precedence edges mergePropertyOrder derives (consecutive pairs per
// side), then Kahn's-algorithm cycle detection decides whether the
// "every edge respected" check below applies to a given random case.
const collectEdges = (lists: string[][]): [string, string][] => {
  const edges: [string, string][] = []
  for (const list of lists) {
    for (let i = 1; i < list.length; i++) edges.push([list[i - 1], list[i]])
  }
  return edges
}

const buildAdjacency = (edges: [string, string][]): Map<string, string[]> => {
  const adjacency = new Map<string, string[]>()
  for (const [from, to] of edges) {
    const successors = adjacency.get(from) ?? []
    successors.push(to)
    adjacency.set(from, successors)
  }
  return adjacency
}

const isAcyclic = (nodes: string[], edges: [string, string][]): boolean => {
  const adjacency = buildAdjacency(edges)
  const indegree = new Map(nodes.map(node => [node, 0]))
  for (const [, to] of edges) indegree.set(to, (indegree.get(to) ?? 0) + 1)

  const ready = nodes.filter(node => indegree.get(node) === 0)
  let removed = 0
  while (ready.length > 0) {
    const node = ready.pop()!
    removed++
    for (const successor of adjacency.get(node) ?? []) {
      const next = indegree.get(successor)! - 1
      indegree.set(successor, next)
      if (next === 0) ready.push(successor)
    }
  }
  return removed === nodes.length
}

const orderOf = (
  ...sides: Parameters<typeof mergePropertyOrder>
): readonly string[] => {
  const merged = mergePropertyOrder(...sides)
  if (merged.blocks.size > 0) throw new Error('unexpected block')
  return merged.order
}

describe('mergePropertyOrder', () => {
  describe('fast path', () => {
    it('given identical key sequences on every side when mergePropertyOrder then returns the shared sequence', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given three empty objects when mergePropertyOrder then returns an empty array', () => {
      // Arrange & Act
      const sut = orderOf({}, {}, {})

      // Assert
      expect(sut).toEqual([])
    })

    it('given an undefined ancestor and matching local/other sequences when mergePropertyOrder then returns the shared sequence', () => {
      // Arrange
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = orderOf(undefined, local, other)

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
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given an ancestor edge that is not a subsequence of matching local/other when mergePropertyOrder then falls through to the general path', () => {
      // Arrange
      const ancestor = { x: 1, a: 2 }
      const local = { a: 1, b: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

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
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b', 'c'])
    })

    it('given local and other of equal length but different keys when mergePropertyOrder then falls through to the general path', () => {
      // Arrange
      const ancestor = { a: 1, b: 2 }
      const local = { a: 1, c: 2 }
      const other = { a: 1, b: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

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
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['description', 'classAccesses', 'tabSettings'])
    })

    it('given other inserting the same key between the same two ancestor keys when mergePropertyOrder then returns the identical order (role symmetry)', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, tabSettings: 2 }
      const other = { description: 1, classAccesses: 2, tabSettings: 3 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['description', 'classAccesses', 'tabSettings'])
    })
  })

  describe('general path — tags only one side carries', () => {
    it('given a tag only other carries when the sides reorder the others then the tag stays where other wrote it', () => {
      // Arrange
      const ancestor = { b: 1, c: 2 }
      const local = { c: 1, b: 2 }
      const other = { b: 1, a: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'c', 'b'])
    })

    it('given both sides dropping a tag the ancestor held and adding another when mergePropertyOrder then the dropped tag follows the kept ones', () => {
      // Arrange
      const ancestor = { b: 1, a: 2 }
      const local = { c: 1, b: 2 }
      const other = { c: 1, b: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['c', 'b', 'a'])
    })

    it('given local emptied and other reversing the ancestor when mergePropertyOrder then the ancestor order stays', () => {
      // Arrange
      const ancestor = { b: 1, a: 2, c: 3 }
      const local = {}
      const other = { c: 1, b: 2, a: 3 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['b', 'a', 'c'])
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
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(expectedOrder)
    })

    it('given the same scenario with local and other swapped when mergePropertyOrder then returns the same order (role symmetry)', () => {
      // Arrange
      const ancestor = { description: 1, tabSettings: 2 }
      const local = { description: 1, classAccesses: 2, tabSettings: 3 }
      const other = { description: 1, fieldPermissions: 2, tabSettings: 3 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert — same result value as the un-swapped case, not a re-typed
      // literal, so an ours-bias regression fails on this symmetry check
      expect(sut).toEqual(expectedOrder)
    })
  })

  describe('general path — a key both sides add where they disagree', () => {
    const expected = {
      order: ['description', 'applicationVisibilities', 'tabSettings'],
      blocks: new Map([
        [
          'applicationVisibilities',
          ['applicationVisibilities', 'classAccesses', 'fieldPermissions'],
        ],
      ]),
    }
    const chain = {
      description: 1,
      fieldPermissions: 2,
      classAccesses: 3,
      tabSettings: 4,
    }
    const longerChain = {
      description: 1,
      classAccesses: 2,
      applicationVisibilities: 3,
      fieldPermissions: 4,
      tabSettings: 5,
    }

    it.each([
      ['local first', chain, longerChain],
      ['other first', longerChain, chain],
    ])(
      'given %s: both sides adding two keys in opposite orders when mergePropertyOrder then one block holds them and the key written between them',
      (_side, local, other) => {
        // Arrange
        const ancestor = { description: 1, tabSettings: 2 }

        // Act
        const sut = mergePropertyOrder(ancestor, local, other)

        // Assert
        expect(sut).toEqual(expected)
      }
    )
  })

  describe('general path — a block holds only what the sides contest', () => {
    it('given a contested pair followed by a key every side agrees on when mergePropertyOrder then the agreed key stays out of the block', () => {
      // Arrange
      const ancestor = { description: 1, label: 2 }
      const local = {
        description: 1,
        tabSettings: 2,
        userPermissions: 3,
        label: 4,
      }
      const other = {
        description: 1,
        userPermissions: 2,
        tabSettings: 3,
        label: 4,
      }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual({
        order: ['description', 'tabSettings', 'label'],
        blocks: new Map([['tabSettings', ['tabSettings', 'userPermissions']]]),
      })
    })

    it('given every key added by both sides in opposite orders when mergePropertyOrder then one block holds them all', () => {
      // Arrange
      const ancestor = {}
      const local = { b: 1, a: 2, c: 3 }
      const other = { c: 1, a: 2, b: 3 }

      // Act
      const sut = mergePropertyOrder(ancestor, local, other)

      // Assert
      expect(sut).toEqual({
        order: ['a'],
        blocks: new Map([['a', ['a', 'b', 'c']]]),
      })
    })
  })

  describe('general path — totality', () => {
    it('given a key dropped by both local and other when mergePropertyOrder then still emits every surviving key exactly once', () => {
      // Arrange
      const ancestor = { description: 1, userLicense: 2, tabSettings: 3 }
      const local = { description: 1, tabSettings: 2 }
      const other = { description: 1, classAccesses: 2, tabSettings: 3 }

      // Act
      const sut = orderOf(ancestor, local, other)

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
      // Arrange — key names deliberately chosen so lexicographic rank
      // disagrees with a local-then-other-then-ancestor concatenation
      // (which would yield ['m1','m2','a1','a2','z']); no side-concat
      // rule can produce this exact result
      const ancestor = { z: 1 }
      const local = { m1: 1, m2: 2 }
      const other = { a1: 1, a2: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a1', 'a2', 'm1', 'm2', 'z'])
    })
  })

  describe('absent ancestor', () => {
    it('given a null ancestor when mergePropertyOrder then contributes no keys', () => {
      // Arrange
      const local = { b: 1, a: 1 }
      const other = { b: 1, a: 1 }

      // Act
      const sut = orderOf(null, local, other)

      // Assert
      expect(sut).toEqual(['b', 'a'])
    })
  })

  describe('array narrowing', () => {
    it('given a JsonArray on one side when mergePropertyOrder then that side contributes no keys', () => {
      // Arrange
      const ancestor = {}
      const local = ['x', 'y']
      const other = { a: 1, b: 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['a', 'b'])
    })

    it('given JsonArrays on every side when mergePropertyOrder then returns an empty array', () => {
      // Arrange
      const ancestor: string[] = ['a']
      const local: string[] = ['b', 'c']
      const other: string[] = ['d']

      // Act
      const sut = orderOf(ancestor, local, other)

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
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['@_a', 'child', 'newChild', '#text'])
    })
  })

  describe('one-sided reorder', () => {
    it.each([
      ['local', { b: 1, a: 2 }, { a: 1, b: 2 }],
      ['other', { a: 1, b: 2 }, { b: 1, a: 2 }],
    ])(
      'given %s reordering two ancestor keys when mergePropertyOrder then keeps the reorder',
      (_side, local, other) => {
        // Arrange
        const ancestor = { a: 1, b: 2 }

        // Act
        const sut = orderOf(ancestor, local, other)

        // Assert
        expect(sut).toEqual(['b', 'a'])
      }
    )

    it('given the unchanged side deleting a key the reordering side kept when mergePropertyOrder then keeps the reorder of the shared keys', () => {
      // Arrange
      const ancestor = { a: 1, b: 2, c: 3 }
      const local = { a: 1, b: 2 }
      const other = { b: 1, a: 2, c: 3 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['b', 'a', 'c'])
    })
  })

  describe('pairwise reorder', () => {
    const letters = (text: string) =>
      Object.fromEntries([...text].map(key => [key, key]))

    it.each([
      ['local first', 'bacd', 'abdc'],
      ['other first', 'abdc', 'bacd'],
    ])(
      'given %s: one side swapping a pair and the other side swapping a disjoint pair when mergePropertyOrder then keeps both swaps',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abcd')

        // Act
        const sut = orderOf(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual(['b', 'a', 'd', 'c'])
      }
    )

    it.each([
      ['local first', 'bcad', 'acbd'],
      ['other first', 'acbd', 'bcad'],
    ])(
      'given %s: one side moving a key past two others and the other side swapping two of them when mergePropertyOrder then orders every pair as a side wrote it',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abcd')

        // Act
        const sut = orderOf(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual(['c', 'b', 'a', 'd'])
      }
    )

    it.each([
      ['local first', 'bac', 'acb'],
      ['other first', 'acb', 'bac'],
    ])(
      'given %s: sides whose reorders of the common keys contradict each other when mergePropertyOrder then names one block holding them',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abc')

        // Act
        const sut = mergePropertyOrder(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual({
          order: ['a'],
          blocks: new Map([['a', ['a', 'b', 'c']]]),
        })
      }
    )

    it.each([
      ['local first', 'bacd', 'acbd'],
      ['other first', 'acbd', 'bacd'],
    ])(
      'given %s: a key no side moved when mergePropertyOrder then it stays out of the block and after it',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abcd')

        // Act
        const sut = mergePropertyOrder(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual({
          order: ['a', 'd'],
          blocks: new Map([['a', ['a', 'b', 'c']]]),
        })
      }
    )

    it.each([
      ['local first', 'bacedf', 'acbdfe'],
      ['other first', 'acbdfe', 'bacedf'],
    ])(
      'given %s: two separate cycles when mergePropertyOrder then names two blocks',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abcdef')

        // Act
        const sut = mergePropertyOrder(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual({
          order: ['a', 'd'],
          blocks: new Map([
            ['a', ['a', 'b', 'c']],
            ['d', ['d', 'e', 'f']],
          ]),
        })
      }
    )

    it.each([
      ['local first', 'baxc', 'acb'],
      ['other first', 'acb', 'baxc'],
    ])(
      'given %s: a key one side wrote between the cycle tags when mergePropertyOrder then the block holds it too',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abc')

        // Act
        const sut = mergePropertyOrder(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual({
          order: ['a'],
          blocks: new Map([['a', ['a', 'b', 'c', 'x']]]),
        })
      }
    )

    it.each([
      ['local first', 'bacd', 'abdc'],
      ['other first', 'abdc', 'bacd'],
    ])(
      'given %s: disjoint swaps when mergePropertyOrder then reports an order, not a cycle',
      (_side, local, other) => {
        // Arrange
        const ancestor = letters('abcd')

        // Act
        const sut = mergePropertyOrder(ancestor, letters(local), letters(other))

        // Assert
        expect(sut).toEqual({ order: ['b', 'a', 'd', 'c'], blocks: new Map() })
      }
    )

    it.each([
      ['local first', 'bac', 'acb', 'x'],
      ['other first', 'acb', 'bac', 'x'],
    ])(
      'given %s: a cycle among common keys and a key only one side added after them when mergePropertyOrder then the block holds the common keys only',
      (_side, local, other, added) => {
        // Arrange
        const ancestor = letters('abc')

        // Act
        const sut = mergePropertyOrder(
          ancestor,
          letters(local + added),
          letters(other)
        )

        // Assert
        expect(sut).toEqual({
          order: ['a', 'x'],
          blocks: new Map([['a', ['a', 'b', 'c']]]),
        })
      }
    )
  })

  describe('#text accepted residual', () => {
    it('given #text entering a rank tie against a newly inserted key when mergePropertyOrder then #text is emitted first (the accepted residual, not a bug — see file header)', () => {
      // Arrange
      const ancestor = { b: 1 }
      const local = { b: 1, z: 2 }
      const other = { b: 1, '#text': 2 }

      // Act
      const sut = orderOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual(['b', '#text', 'z'])
    })
  })

  describe('property lens', () => {
    it('given randomised key sequences when mergePropertyOrder then the result is a permutation of the key union', () => {
      fc.assert(
        fc.property(keyTrio, ([ancestorKeys, localKeys, otherKeys]) => {
          // Arrange
          const union = new Set([...ancestorKeys, ...localKeys, ...otherKeys])

          // Act
          const sut = mergePropertyOrder(
            toObject(ancestorKeys),
            toObject(localKeys),
            toObject(otherKeys)
          )

          // Assert — a block stands for its tags in the order
          const named = sut.order.flatMap(
            name => sut.blocks.get(name) ?? [name]
          )
          expect([...named].sort()).toEqual([...union].sort())
        })
      )
    })

    it('given randomised key sequences when mergePropertyOrder then each block is one contiguous run in local and in other', () => {
      fc.assert(
        fc.property(keyTrio, ([ancestorKeys, ...resolvable]) => {
          // Arrange
          const [local, other] = resolvable.map(toObject)
          const ancestor = toObject(ancestorKeys)

          // Act
          const sut = mergePropertyOrder(ancestor, local, other)

          // Assert
          for (const tags of sut.blocks.values()) {
            for (const side of resolvable) {
              const at = side.flatMap((key, i) =>
                tags.includes(key) ? [i] : []
              )
              expect(at).toEqual(
                Array.from({ length: at.length }, (_, i) => (at[0] ?? 0) + i)
              )
            }
          }
        })
      )
    })

    it('given randomised key sequences when mergePropertyOrder is invoked twice on the same inputs then the results are identical', () => {
      fc.assert(
        fc.property(keyTrio, ([ancestorKeys, localKeys, otherKeys]) => {
          // Arrange
          const ancestor = toObject(ancestorKeys)
          const local = toObject(localKeys)
          const other = toObject(otherKeys)

          // Act
          const first = mergePropertyOrder(ancestor, local, other)
          const second = mergePropertyOrder(ancestor, local, other)

          // Assert
          expect(second).toEqual(first)
        })
      )
    })

    it('given randomised key sequences when local and other are swapped then mergePropertyOrder returns the same order', () => {
      fc.assert(
        fc.property(keyTrio, ([ancestorKeys, localKeys, otherKeys]) => {
          // Arrange
          const ancestor = toObject(ancestorKeys)
          const local = toObject(localKeys)
          const other = toObject(otherKeys)

          // Act
          const forward = mergePropertyOrder(ancestor, local, other)
          const swapped = mergePropertyOrder(ancestor, other, local)

          // Assert
          expect(swapped).toEqual(forward)
        })
      )
    })

    it('given randomised acyclic key sequences when mergePropertyOrder then the result is a valid topological order of the union precedence graph', () => {
      fc.assert(
        fc.property(keyTrio, ([ancestorKeys, localKeys, otherKeys]) => {
          // Arrange — restricted to acyclic graphs: a cycle repair emission
          // can cascade past a downstream acyclic edge, so "every edge
          // respected" is not an invariant of cyclic inputs even for a
          // correct implementation
          const lists = [ancestorKeys, localKeys, otherKeys]
          const nodes = [...new Set(lists.flat())]
          const edges = collectEdges(lists)
          fc.pre(isAcyclic(nodes, edges))

          // Act
          const sut = orderOf(
            toObject(ancestorKeys),
            toObject(localKeys),
            toObject(otherKeys)
          )

          // Assert — every node in `edges` is guaranteed present in `sut`
          // by the permutation property above, so the lookups are total
          const position = new Map(sut.map((key, index) => [key, index]))
          for (const [from, to] of edges) {
            expect(position.get(from)!).toBeLessThan(position.get(to)!)
          }
        })
      )
    })
  })
})
