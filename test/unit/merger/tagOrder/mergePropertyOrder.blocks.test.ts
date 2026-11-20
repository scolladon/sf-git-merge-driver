import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ContestedTagOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'
import { mergePropertyOrder } from '../../../../src/merger/tagOrder/mergePropertyOrder.js'
import {
  referenceOrder,
  referenceRootOrder,
} from '../laws/childTagReference.js'

const tagsOf = (text: string): string[] => [...text]
const objectOf = (tags: string[]) =>
  Object.fromEntries(tags.map(tag => [tag, tag]))

const mergeOf = (ancestor: string[], local: string[], other: string[]) =>
  mergePropertyOrder(objectOf(ancestor), objectOf(local), objectOf(other))

const permutations = (tags: string[]): string[][] =>
  tags.length <= 1
    ? [tags]
    : tags.flatMap((tag, at) =>
        permutations([...tags.slice(0, at), ...tags.slice(at + 1)]).map(
          rest => [tag, ...rest]
        )
      )

// The ordered subsets of some tags, the empty one included
const sequencesOf = (tags: string[]): string[][] => [
  [],
  ...tags.flatMap((tag, at) =>
    sequencesOf([...tags.slice(0, at), ...tags.slice(at + 1)]).map(rest => [
      tag,
      ...rest,
    ])
  ),
]

// What mergePropertyOrder names, seen the way the reference states it
const asReference = (
  sut: ReturnType<typeof mergePropertyOrder>,
  local: string[],
  other: string[]
) => {
  const shared = new Set(local.filter(tag => other.includes(tag)))
  return {
    blocks: [...sut.blocks.values()]
      .map(tags => [...tags].sort())
      .sort((x, y) => (x[0] < y[0] ? -1 : 1)),
    sharedOrder: sut.order.filter(name =>
      (sut.blocks.get(name) ?? [name]).some(tag => shared.has(tag))
    ),
  }
}

type Trio = string[][]

const nestedMismatch = ([ancestor, local, other]: Trio): boolean => {
  const sut = asReference(mergeOf(ancestor, local, other), local, other)
  return (
    JSON.stringify(sut) !==
    JSON.stringify(referenceOrder(ancestor, local, other))
  )
}

// At the root the blocks are gone: the tags they would hold, and the tags
// both sides carry, stand in the order the reference gives
const rootMismatch = ([ancestor, local, other]: Trio): boolean => {
  const sut = mergePropertyOrder(
    objectOf(ancestor),
    objectOf(local),
    objectOf(other),
    ContestedTagOrder.CANONICAL
  )
  const { blocks } = referenceOrder(ancestor, local, other)
  const written = new Set([
    ...blocks.flat(),
    ...local.filter(tag => other.includes(tag)),
  ])
  return (
    sut.blocks.size > 0 ||
    JSON.stringify(sut.order.filter(tag => written.has(tag))) !==
      JSON.stringify(referenceRootOrder(ancestor, local, other))
  )
}

const LEVELS = [
  ['nested', nestedMismatch],
  ['root', rootMismatch],
] as const

const mismatches = (
  cases: Iterable<Trio>,
  isMismatch: (trio: Trio) => boolean
): Trio[] => [...cases].filter(isMismatch)

function* everyPermutationPair(size: number): Generator<string[][]> {
  const ancestor = tagsOf('abcdefgh'.slice(0, size))
  const orders = permutations(ancestor)
  for (const local of orders) {
    for (const other of orders) yield [ancestor, local, other]
  }
}

function* everySequenceTrio(tags: string[]): Generator<string[][]> {
  const sequences = sequencesOf(tags)
  for (const ancestor of sequences) {
    for (const local of sequences) {
      for (const other of sequences) yield [ancestor, local, other]
    }
  }
}

const POOL = tagsOf('abcdefghij')

// Sides made of moves, additions and deletions on an ancestor, so that the
// cycles, the added tags and the deleted ones all turn up
const trioArb = fc
  .shuffledSubarray(POOL, { minLength: 2 })
  .chain(ancestor =>
    fc.tuple(
      fc.constant(ancestor),
      sideArb(ancestor, POOL),
      sideArb(ancestor, POOL)
    )
  )

const sideArb = (ancestor: string[], pool: string[]) =>
  fc
    .tuple(
      fc.shuffledSubarray(ancestor),
      fc.shuffledSubarray(pool.filter(tag => !ancestor.includes(tag))),
      fc.nat(100)
    )
    .map(([kept, added, shift]) => rotated([...kept, ...added], shift))

const rotated = (tags: string[], by: number): string[] =>
  tags.length === 0
    ? tags
    : [...tags.slice(by % tags.length), ...tags.slice(0, by % tags.length)]

const WIDE_POOL = Array.from(
  { length: 90 },
  (_, at) => `t${String(at).padStart(2, '0')}`
)
const MIN_WIDE_TAGS = 70
const MOVES_PER_SIDE = 6
const MAX_ADDED_TAGS = 2
const MAX_MOVE_DISTANCE = 3

const relocated = (tags: string[], [from, to]: number[]): string[] => {
  const moved = [...tags]
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved
}

// Few moves and additions on a wide ancestor: enough tags for the sweeps, and
// few enough inversions for the blocks to stay small
const wideTrioArb = fc
  .shuffledSubarray(WIDE_POOL, {
    minLength: MIN_WIDE_TAGS,
    maxLength: WIDE_POOL.length - MAX_ADDED_TAGS,
  })
  .chain(ancestor => {
    const moves = fc.array(
      fc
        .tuple(
          fc.nat({ max: ancestor.length - 1 }),
          fc.integer({ min: -MAX_MOVE_DISTANCE, max: MAX_MOVE_DISTANCE })
        )
        .map(([from, by]) => [from, Math.max(0, from + by)]),
      { maxLength: MOVES_PER_SIDE }
    )
    const added = fc.shuffledSubarray(
      WIDE_POOL.filter(tag => !ancestor.includes(tag)),
      { maxLength: MAX_ADDED_TAGS }
    )
    const side = fc
      .tuple(moves, added)
      .map(([made, extra]) => [...made.reduce(relocated, ancestor), ...extra])
    return fc.tuple(fc.constant(ancestor), side, side)
  })

describe.each(LEVELS)(
  'mergePropertyOrder against the reference at the %s level',
  (_level, isMismatch) => {
    describe('given the sides of up to five tags the ancestor carries', () => {
      it.each([2, 3, 4, 5])(
        'when every pair of orders of %i tags is merged then each matches the reference',
        size => {
          // Arrange
          const cases = everyPermutationPair(size)

          // Act
          const sut = mismatches(cases, isMismatch)

          // Assert
          expect(sut).toEqual([])
        }
      )
    })

    describe('given every sequence the sides could write over three tags', () => {
      it('when each trio is merged then each matches the reference', () => {
        // Arrange
        const cases = everySequenceTrio(tagsOf('abc'))

        // Act
        const sut = mismatches(cases, isMismatch)

        // Assert
        expect(sut).toEqual([])
      })
    })

    describe('given sides that move, add and delete tags', () => {
      it('when merged then each matches the reference', () => {
        fc.assert(
          fc.property(trioArb, ([ancestor, local, other]) => {
            // Arrange
            const cases = [[ancestor, local, other]]

            // Act
            const sut = mismatches(cases, isMismatch)

            // Assert
            expect(sut).toEqual([])
          }),
          { numRuns: 3000 }
        )
      })
    })
  }
)

describe.each(LEVELS)(
  'mergePropertyOrder against the reference on wide elements at the %s level',
  (_level, isMismatch) => {
    describe('given sides of seventy tags or more that move and add a few', () => {
      // The reference enumerates orders, so this is a correctness oracle,
      // not a time bound: under coverage on a busy runner it outlasts 5s
      const ORACLE_TIMEOUT_MS = 30_000

      it('when merged then each matches the reference', {
        timeout: ORACLE_TIMEOUT_MS,
      }, () => {
        fc.assert(
          fc.property(wideTrioArb, trio => {
            // Arrange & Act
            const sut = mismatches([trio], isMismatch)

            // Assert
            expect(sut).toEqual([])
          }),
          { numRuns: 60 }
        )
      })
    })
  }
)

describe('mergePropertyOrder blocks', () => {
  describe('given a cycle that widening hides', () => {
    it.each([
      ['local first', 'acebd', 'dbeac'],
      ['other first', 'dbeac', 'acebd'],
    ])(
      'when %s: each side writes tags between the other cycle tags then one block holds all five',
      (_side, local, other) => {
        // Arrange
        const ancestor = 'abcde'

        // Act
        const sut = mergeOf(tagsOf(ancestor), tagsOf(local), tagsOf(other))

        // Assert
        expect(sut).toEqual({
          order: ['a'],
          blocks: new Map([['a', tagsOf('abcde')]]),
        })
      }
    )
  })

  describe('given a tag both sides add at positions that disagree', () => {
    it.each([
      ['local first', 'eab', 'abe'],
      ['other first', 'abe', 'eab'],
    ])(
      'when %s: the sides place it at either end of the ancestor then one block spans the tags between its positions',
      (_side, local, other) => {
        // Arrange
        const ancestor = 'ab'

        // Act
        const sut = mergeOf(tagsOf(ancestor), tagsOf(local), tagsOf(other))

        // Assert
        expect(sut).toEqual({
          order: ['a'],
          blocks: new Map([['a', ['a', 'b', 'e']]]),
        })
      }
    )

    it('when both sides add it at the same place then it stays out of every block', () => {
      // Arrange
      const [ancestor, local, other] = ['ab', 'eab', 'eab'].map(tagsOf)

      // Act
      const sut = mergeOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual({ order: tagsOf('eab'), blocks: new Map() })
    })
  })
})

describe('mergePropertyOrder around tags only one side carries', () => {
  describe('given tags that cycle among themselves around the tags both sides carry', () => {
    it.each([
      [
        'ancestor and local tags cycle around a tag both add',
        'chg',
        'ghbe',
        'hce',
        'he',
      ],
      [
        'a tag both sides add follows the tag each side keeps',
        'abd',
        'dac',
        'dbc',
        'dc',
      ],
      [
        'five tags drop out of one side',
        'edcfhgbjai',
        'ghafjbcei',
        'hfibd',
        'hfib',
      ],
    ])(
      'when %s then the shared tags come out in the order the sides leave',
      (_case, ancestor, local, other, shared) => {
        // Arrange
        const orientations = [
          [local, other],
          [other, local],
        ]

        // Act
        const sut = orientations.map(([first, second]) =>
          mergeOf(tagsOf(ancestor), tagsOf(first), tagsOf(second)).order.filter(
            tag => shared.includes(tag)
          )
        )

        // Assert
        expect(sut).toEqual([tagsOf(shared), tagsOf(shared)])
      }
    )
  })
})

describe('mergePropertyOrder on many tags', () => {
  const ONE_SECOND = 1000
  const tagName = (at: number): string => `tag${String(at).padStart(6, '0')}`

  // Each side swaps neighbours of a descending run, the other side the
  // neighbours in between: every swap links the next one to the same block
  const swappedNeighbours = (count: number) => {
    const ancestor = Array.from({ length: count }, (_, at) =>
      tagName(count - at)
    )
    const swapFrom = (first: number): string[] => {
      const swapped = [...ancestor]
      for (let at = first; at + 1 < count; at += 2) {
        ;[swapped[at], swapped[at + 1]] = [swapped[at + 1], swapped[at]]
      }
      return swapped
    }
    return { ancestor, local: swapFrom(0), other: swapFrom(1) }
  }

  // Tags both sides add, each side shifting the pairs the other one wrote
  const pingPong = (count: number) => {
    const pairs = (from: number): string[] =>
      Array.from({ length: Math.ceil(count / 2) }, (_, at) =>
        [from + 2 * at, from + 2 * at + 1].filter(n => n <= count)
      )
        .reverse()
        .flat()
        .map(tagName)
    return {
      ancestor: ['x', 'y', 'z'],
      local: [...pairs(2), 'y', 'x', tagName(1), 'z'],
      other: [...pairs(1), 'x', 'z', 'y'],
    }
  }

  describe('given a chain of added tags the sides shift against each other', () => {
    it('when merging 16000 of them then the block comes back within a second', () => {
      // Arrange
      const { ancestor, local, other } = pingPong(16000)
      const start = performance.now()

      // Act
      const sut = mergeOf(ancestor, local, other)

      // Assert
      expect(performance.now() - start).toBeLessThan(ONE_SECOND)
      expect([...sut.blocks.values()].map(tags => tags.length)).toEqual([16003])
    })
  })

  describe('given a chain of neighbours swapped by one side or the other', () => {
    it('when merging 24000 tags then they come back as one block without overflowing the stack', () => {
      // Arrange
      const { ancestor, local, other } = swappedNeighbours(24000)

      // Act
      const sut = mergeOf(ancestor, local, other)

      // Assert
      expect([...sut.blocks.values()].map(tags => tags.length)).toEqual([24000])
    })
  })
})
