import { describe, expect, it } from 'vitest'
import {
  mergeOrderedArrays,
  mergeReading,
} from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import {
  formatResult,
  ORDERED_ATTRIBUTE,
  orderedSides,
  readingsOf,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

type Row = readonly [
  name: string,
  ancestor: string,
  local: string,
  other: string,
  expected: string,
]

const BLOCK = /<([^|>]*)\|([^|>]*)\|([^|>]*)>/g

const swapBlockSides = (formatted: string): string =>
  formatted.replace(BLOCK, '<$3|$2|$1>')

const mergeFormatted = (
  ancestor: string,
  local: string,
  other: string
): string =>
  formatResult(
    mergeOrderedArrays(
      orderedSides(ancestor, local, other),
      ORDERED_ATTRIBUTE,
      defaultConfig
    )
  )

const KNOWN_ROWS: readonly Row[] = [
  ['both sides reorder the same way', 'C B', 'B C', 'B C', 'B,C (clean)'],
  ['reorder against relabel and delete', 'C D', 'D C', 'C*', '<D|D|∅>,C*'],
  [
    'both move one entry with different gap insertions',
    'K B',
    'B X K',
    'B Y K',
    'B,<X|∅|Y>,K',
  ],
  ['only one side changes the set', 'A B', 'A B', 'X B A', 'X,B,A (clean)'],
  ['delete against move and relabel', 'K B C', 'B C', 'B C K*', 'B,C,<∅|K|K*>'],
  ['delete against a pure move', 'K B C', 'B C', 'B C K', 'B,C,<∅|K|K>'],
  ['delete and append against move', 'K B C', 'B C Z', 'B C K', 'B,C,<Z|K|K>'],
  [
    'two swaps in different regions',
    'A B C D',
    'B A C D',
    'A B D C',
    'B,A,D,C (clean)',
  ],
  [
    'both swap and one swaps more',
    'A B C D',
    'B A D C',
    'B A C D',
    'B,A,D,C (clean)',
  ],
  [
    'agreed move beside a tail swap',
    'K A B C',
    'A K B C',
    'A K C B',
    'A,K,C,B (clean)',
  ],
  [
    'agreed move with an appended entry',
    'K A B C',
    'A K B C X',
    'A K C B',
    'A,K,C,B,X (clean)',
  ],
  ['swap against append', 'A B', 'B A', 'A B X', 'B,A,X (clean)'],
  [
    'replacement with a different middle entry',
    'A B C D',
    'A X Y Z D',
    'A X W Z D',
    'A,X,<Y|B,C|W>,Z,D',
  ],
  ['insertion between against swap', 'A B', 'A X B', 'B A', '<A,X,B|A,B|B,A>'],
  [
    'insertions at different places',
    'A B C',
    'A X B C',
    'A B X C',
    'A,<X,B|B|B,X>,C',
  ],
  [
    'moves of one entry to different places',
    'A B C D',
    'B C A D',
    'B A C D',
    'B,<C,A|A,C|A,C>,D',
  ],
  [
    'different appends after a swap',
    'A B C D',
    'B A C D X',
    'A B C D Y',
    'B,A,C,D,<X|∅|Y>',
  ],
  [
    'appended pairs in opposite order after a swap',
    'A B C D',
    'B A C D X Y',
    'A B C D Y X',
    'B,A,C,D,<X,Y|∅|Y,X>',
  ],
  [
    'appended pairs in opposite order',
    'A B C',
    'A B C X Y',
    'A B C Y X',
    'A,B,C,<X,Y|∅|Y,X>',
  ],
  ['repeated key edited in place', 'A B A', 'A B', 'A* B A', 'A*,B (clean)'],
  [
    'repeated key readings disagree on delete against modify',
    'A B A',
    'A',
    'A*',
    '<A|A,B,A|A*>',
  ],
  [
    'repeated key readings disagree on order',
    'A B A',
    'A B',
    'B A',
    '<A,B|A,B,A|B,A>',
  ],
  [
    'repeated key readings agree after an append',
    'A B A',
    'A',
    'A X',
    'A,X (clean)',
  ],
  [
    'repeated key kept by both after a move',
    'A B C A',
    'A B C',
    'C A B',
    'C,A,B (clean)',
  ],
  [
    'delete and move against delete of both',
    'A B C',
    'C A',
    'C',
    'C,<A|A,B|∅>',
  ],
  [
    'edit against insertion of the same key',
    'A B C',
    'A B C A*',
    'A B C*',
    'A,B,C*,A* (clean)',
  ],
  [
    'agreed insertion beside an edit',
    'A B C',
    'A B A* C X',
    'A B A* C*',
    'A,B,A*,C*,X (clean)',
  ],
  ['overlapping swaps', 'A B C', 'B A C', 'A C B', '<B,A,C|A,B,C|A,C,B>'],
  ['adjacent deletions', 'A B C D', 'A D', 'A B D', 'A,D (clean)'],
  ['insertions claiming one gap', 'A C', 'A B C', 'A C B', 'A,<B,C|C|C,B>'],
  ['swap against append in one slot', 'A B', 'B A X', 'A B Y', 'B,A,<X|∅|Y>'],
  [
    'adjacent deletions in a longer list',
    'A B C D',
    'A C D',
    'A B D',
    'A,D (clean)',
  ],
  [
    'moved entry with a deleted neighbour',
    'K B D',
    'B X K',
    'B Y K',
    'B,<X|D|Y>,K',
  ],
  ['insertion beside a deletion', 'A B C', 'A X B C', 'A C', 'A,X,C (clean)'],
  [
    'edit against move of one entry',
    'K B C',
    'K* B C',
    'B C K',
    'B,C,K* (clean)',
  ],
  ['edits of different entries', 'A B', 'A* B', 'A B+', 'A*,B+ (clean)'],
  ['swap against longer append', 'A B', 'B A X', 'A B X Y', 'B,A,X,Y (clean)'],
  [
    'delete against insertions and edit',
    'A B C',
    'A',
    'X C* Y A',
    'X,<∅|B,C|C*>,Y,A',
  ],
  ['edit against insertion', 'A B', 'A X B', 'A* X B', 'A*,X,B (clean)'],
  [
    'move against insertion beside the target',
    'A B C',
    'C A B',
    'A B X C',
    '<C,A,B|A,B,C|A,B,X,C>',
  ],
  ['move against deletion', 'A B C', 'B C A', 'B A', 'B,A (clean)'],
  [
    'moves of disjoint entries',
    'A B C D',
    'D A B C',
    'A C B D',
    'D,A,C,B (clean)',
  ],
  [
    'rotation against two gap insertions',
    'A B C D',
    'A X B C Y D',
    'C D A B',
    '<A,X,B,C,Y,D|A,B,C,D|C,D,A,B>',
  ],
  [
    'insertions of pairs in one gap',
    'A B',
    'A X Y B',
    'A W Z B',
    'A,<X,Y|∅|W,Z>,B',
  ],
  [
    'insertion against a longer insertion',
    'A B',
    'A X B',
    'A Y Z W B',
    'A,<X|∅|Y,Z,W>,B',
  ],
  ['delete against replace', 'A B', 'A X', 'A Y B', 'A,Y,X (clean)'],
  [
    'agreed insertion of a repeated key',
    'A B C',
    'A B A* C X',
    'A B A* C*',
    'A,B,A*,C*,X (clean)',
  ],
  [
    'ambiguous repeated key remainder',
    'A B C',
    'B A C',
    'A* A+ C B',
    '<B,A,C|A,B,C|A*,A+,C,B>',
  ],
  [
    'move and delete against edit',
    'A B C D',
    'B A C',
    'A B C* D',
    'B,A,C* (clean)',
  ],
]
const EXTRA_ROWS: readonly Row[] = [
  [
    'both append one entry and one inserts before it',
    'P',
    'P D',
    'P B D',
    'P,B,D (clean)',
  ],
  [
    'both append one entry and the other inserts before it',
    'P',
    'P B D',
    'P D',
    'P,B,D (clean)',
  ],
  [
    'second entry of one key against append',
    'A B',
    'A A* B',
    'A B X',
    'A,A*,B,X (clean)',
  ],
  [
    'append against second entry of one key',
    'A B',
    'A B X',
    'A A* B',
    'A,A*,B,X (clean)',
  ],
  [
    'different fields of one entry',
    'A:x/y B',
    'A:x*/y B',
    'A:x/y* B',
    'A:x*/y*,B (clean)',
  ],
  [
    'one field edited differently',
    'A:x/y B',
    'A:x*/y B',
    'A:x+/y B',
    '<A:x*/y|A:x/y|A:x+/y>,B',
  ],
  ['insertion against swap with edit', 'A B', 'A X', 'X A*', '<A,X|A,B|X,A*>'],
  ['agreed edit with an appended copy', 'A B', 'A*', 'A* A+', 'A*,A+ (clean)'],
]
const INSERTION_ROWS: readonly Row[] = [
  [
    'both sides insert one key with different content',
    '',
    'A*',
    'A+',
    '<A*|∅|A+>',
  ],
]
const ORDER_THROUGH_SHARED_ROWS: readonly Row[] = [
  [
    'agreed insertions ordered through a shared entry',
    'A B C',
    'A X B C Y',
    'C Y A X B',
    'C,Y,A,X,B (clean)',
  ],
  [
    'agreed insertions ordered through a shared entry beside a dispute',
    'A B C',
    'A X B C Y',
    'C Y A B X',
    'C,Y,A,<X,B|B|B,X>',
  ],
]
const READING_ROWS: readonly Row[] = [
  [
    'repeated key readings disagree after a shared head',
    'P A B A',
    'P A B',
    'P B A',
    'P,<A,B|A,B,A|B,A>',
  ],
  [
    'repeated key readings disagree before a shared tail',
    'A B A Q',
    'A B Q',
    'B A Q',
    '<A,B|A,B,A|B,A>,Q',
  ],
  [
    'repeated key readings disagree between a shared head and tail',
    'P A B A Q',
    'P A B Q',
    'P B A Q',
    'P,<A,B|A,B,A|B,A>,Q',
  ],
  [
    'conflicting repeated key readings keep the whole array inside the markers',
    'P A B A',
    'P A',
    'P A*',
    '<P,A|P,A,B,A|P,A*>',
  ],
  [
    'repeated key readings disagree with a shared tail beside the base',
    'A A B',
    'A* B A B',
    'A B A B',
    '<A*,B|A|A,B>,A,B',
  ],
  [
    'repeated key readings disagree up to the shortest side',
    'A B A B',
    'A A* A A',
    'A',
    '<A,A*,A|A,B,A,B|∅>,A',
  ],
  [
    'repeated key readings disagree after an inserted head',
    'A B A',
    'X A B',
    'X B A',
    'X,<A,B|A,B,A|B,A>',
  ],
  [
    'repeated key readings disagree before an inserted tail',
    'A B A',
    'A B X',
    'B A X',
    '<A,B|A,B,A|B,A>,X',
  ],
]
const KEYLESS_ROWS: readonly Row[] = [
  [
    'keyless duplicates whose tail stops at the shortest side',
    '~a ~a ~a ~a',
    '~a ~a',
    '~a ~a ~a',
    '~a,<~a|~a,~a,~a|~a,~a>',
  ],
  [
    'keyless edit in place with an append',
    '~a ~b ~c',
    '~a ~b* ~c',
    '~a ~b ~c ~d',
    '~a,~b*,~c,~d (clean)',
  ],
  [
    'keyless delete against edit with an append',
    '~a ~b ~c',
    '~a ~c',
    '~a ~b ~c* ~d',
    '~a,~c*,~d (clean)',
  ],
  [
    'keyless duplicates whose readings agree',
    '~a ~a ~b',
    '~a ~b',
    '~a ~a ~b*',
    '~a,~b* (clean)',
  ],
  [
    'keyless replacement next to an append',
    '~a ~b',
    '~a ~a',
    '~a ~b ~x',
    '~a,~a,~x (clean)',
  ],
  [
    'keyless entry deleted by one side and edited by the other',
    '~a ~b ~c',
    '~a ~c',
    '~a ~b* ~c',
    '~a,~b*,~c (clean)',
  ],
  [
    'both sides edit one keyless entry differently',
    '~a ~b ~c',
    '~a ~b* ~c',
    '~a ~b+ ~c',
    '~a,<~b*|~b|~b+>,~c',
  ],
  [
    'both sides edit one keyless entry the same way',
    '~a ~b ~c',
    '~a ~b* ~c',
    '~a ~b* ~c',
    '~a,~b*,~c (clean)',
  ],
]

const REPLACEMENT_ROWS: readonly Row[] = [
  [
    'keyless neighbours edited on each side',
    '~e1 ~e2',
    '~e1* ~e2',
    '~e1 ~e2*',
    '~e1*,~e2* (clean)',
  ],
  [
    'keyless neighbours edited around agreed insertions',
    '~e1 ~e2',
    '~e3 ~e1* ~e2 ~e4',
    '~e3 ~e1 ~e2* ~e4',
    '~e3,~e1*,~e2*,~e4 (clean)',
  ],
  [
    'keyless entry replaced differently by each side',
    '~e1',
    '~e1*',
    '~e1+',
    '<~e1*|~e1|~e1+>',
  ],
  [
    'keyless surplus copy of an agreed value',
    '~a ~b',
    '~a ~p',
    '~p ~p',
    '~p,~p (clean)',
  ],
  ['neighbours replaced on each side', 'A B', 'X B', 'A Y', 'X,Y (clean)'],
  ['replacements of overlapping entries', 'A B C', 'X C', 'A Y', '<X|A,B,C|Y>'],
  ['replacement beside an append', 'A B', 'X B', 'A B Y', 'X,B,Y (clean)'],
  [
    'replacement of the only entry beside an append',
    'A',
    'X',
    'A Y',
    'X,Y (clean)',
  ],
  [
    'replacement of the first entries beside an append',
    'A B',
    'X',
    'B Y',
    'X,Y (clean)',
  ],
  [
    'replacement by a run of another length',
    'A B C D',
    'X E D',
    'A B C D Y',
    'X,E,D,Y (clean)',
  ],
  [
    'replacement by a longer run beside an append',
    'A B C',
    'X Y Z C',
    'A B C W',
    'X,Y,Z,C,W (clean)',
  ],
  [
    'replacement of an entry the other side moved',
    'A B C',
    'X B C',
    'B C A',
    'X,B,C,<∅|A|A>',
  ],
  ['append against delete and move', 'K B C', 'B C Z', 'B C K', 'B,C,<Z|K|K>'],
  [
    'replacement against the move of a bystander',
    'A B C',
    'X B C',
    'C A B',
    'C,X,B (clean)',
  ],
  [
    'replacement of the tail against a move',
    'A B C',
    'A X',
    'B C A',
    'X,A (clean)',
  ],
  [
    'replacement with an insertion inside the replaced span',
    'A B',
    'X',
    'A Y B',
    '<X|A,B|Y>',
  ],
  ['replacement of an entry the other side edited', 'A', 'X', 'A*', '<X|A|A*>'],
  [
    'agreed insertion beyond the replaced place',
    'A',
    'A X',
    'X Y',
    'X,<∅|A|Y>',
  ],
  [
    'agreed insertion beyond a replaced entry in a longer list',
    'A B',
    'X Y B',
    'A X B',
    'X,<Y|A|∅>,B',
  ],
  [
    'replacement of a repeated key beside edited copies',
    'A B',
    'A* A',
    'A* X A*',
    '<A*,A|A,B|A*,X,A*>',
  ],
  [
    'replacements beside agreed insertions',
    'A B',
    'C X B',
    'C A Y',
    'C,X,Y (clean)',
  ],
  [
    'replacement of an entry in the middle of the other side edits',
    'A B C',
    'A X C',
    'A* B C*',
    'A*,X,C* (clean)',
  ],
  [
    'replacements of the two sides claiming one gap',
    'A B C',
    'B X',
    'Y A',
    '<X|A,B,C|Y>',
  ],
  [
    'the same content replacing neighbouring entries on each side',
    '~a ~b',
    '~x ~b',
    '~a ~x',
    '~x (clean)',
  ],
  [
    'the same content replacing neighbouring entries beside a bystander',
    '~a ~b ~c',
    '~x ~b ~c',
    '~a ~x ~c',
    '~x,~c (clean)',
  ],
  [
    'the same content replacing entries with a kept entry between',
    '~a ~b ~c',
    '~x ~b ~c',
    '~a ~b ~x',
    '<~x,~b,~c|~a,~b,~c|~a,~b,~x>',
  ],
  [
    'the same content replacing the same entry on each side',
    '~a ~b ~c',
    '~x ~b ~c',
    '~x ~b',
    '~x,~b (clean)',
  ],
  [
    'the same content inserted by both sides beside a bystander',
    '~a ~b',
    '~a ~x ~b',
    '~a ~x ~b ~y',
    '~a,~x,~b,~y (clean)',
  ],
  [
    'the same content after an edit of the entry one side replaced',
    'A B',
    'X B',
    'A* X',
    '<∅|A,B|A*>,X',
  ],
  [
    'the same content after an edit of one of the entries one side replaced',
    'A B C',
    'X C',
    'A* B X',
    '<∅|A,B,C|A*>,X',
  ],
  [
    'the same content replacing an entry both sides removed',
    'A B C',
    'A B X',
    'X B',
    '<A,B,X|A,B,C|X,B>',
  ],
  [
    'the same content across an entry the sides keep and another one adds',
    'A B C',
    'A X B Y',
    'Y B',
    '<A,X,B,Y|A,B,C|Y,B>',
  ],
  [
    'the same content after an edit of a copy one side replaced',
    'A B A',
    'A B X',
    'X B A*',
    '<B,X|A,B,A|X,B,A*>',
  ],
  [
    'the same content after an edit of one of two entries one side replaced',
    'A B C D',
    'X C D',
    'A* B C X',
    '<X,C|A,B,C,D|A*,C,X>',
  ],
  [
    'replacement of two entries where the other side kept one',
    'A B',
    'X',
    'Y A',
    'Y,X (clean)',
  ],
  [
    'common tail of the two sides outside the markers',
    'A',
    'X A',
    'Y X',
    '<∅|A|Y>,X',
  ],
  [
    'copies conflicting alike against an appended entry',
    'A B A',
    'A* A*',
    'A+ A+ B',
    '<A*,A*|A,B,A|A+,A+,B>',
  ],
  ['replacements in different slots', 'A B C', 'B X', 'Y B', 'Y,B,X (clean)'],
  [
    'replacements of one slot ordered by their places',
    'A B C D',
    'Z B',
    'C X',
    'Z,X (clean)',
  ],
  [
    'replacements the assembled order puts against their places',
    '~a ~b ~a',
    '~p ~p ~b',
    '~b ~q ~p',
    '<~p,~p,~b|~a,~b,~a|~b,~q,~p>',
  ],
]

const ROWS: readonly Row[] = [
  ...KNOWN_ROWS,
  ...EXTRA_ROWS,
  ...INSERTION_ROWS,
  ...ORDER_THROUGH_SHARED_ROWS,
  ...READING_ROWS,
  ...KEYLESS_ROWS,
  ...REPLACEMENT_ROWS,
]

describe('mergeOrderedArrays', () => {
  describe('given the pinned ordered cases', () => {
    describe('when merging local and other against the ancestor', () => {
      it.each(ROWS)(
        'then %s merges to the doctrine result',
        (_name, ancestor, local, other, expected) => {
          // Arrange
          const sides = [ancestor, local, other] as const

          // Act
          const sut = mergeFormatted(...sides)

          // Assert
          expect(sut).toBe(expected)
        }
      )
    })

    describe('when the two live sides swap roles', () => {
      it.each(ROWS)(
        'then %s swaps the block sides',
        (_name, ancestor, local, other, expected) => {
          // Arrange
          const sides = [ancestor, other, local] as const

          // Act
          const sut = mergeFormatted(...sides)

          // Assert
          expect(sut).toBe(swapBlockSides(expected))
        }
      )
    })
  })

  describe('given entries carrying attributes', () => {
    describe('when both sides edit one entry', () => {
      it('then the entry conflicts as one text unit with its attributes', () => {
        // Arrange
        const item = (label: string) => ({
          '@_n1:nil': 'false',
          fullName: 'A',
          label,
        })
        const keys = ['A']
        const sut = mergeOrderedArrays(
          {
            ancestor: [item('f')],
            local: [item('t')],
            other: [item('m')],
            keys: { ancestor: keys, local: keys, other: keys },
          },
          ORDERED_ATTRIBUTE,
          defaultConfig
        )

        // Act
        const result = sut

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: [{ [ORDERED_ATTRIBUTE]: item('t') }],
              ancestor: [{ [ORDERED_ATTRIBUTE]: item('f') }],
              other: [{ [ORDERED_ATTRIBUTE]: item('m') }],
            },
          ],
          hasConflict: true,
        })
      })
    })
  })

  describe('given an entry whose fields each side deleted', () => {
    describe('when both sides keep the entry', () => {
      it('then the entry merges to nothing', () => {
        // Arrange
        const keys = ['A']
        const sut = mergeOrderedArrays(
          {
            ancestor: [{ editable: 'true', readable: 'true' }],
            local: [{ editable: 'true' }],
            other: [{ readable: 'true' }],
            keys: { ancestor: keys, local: keys, other: keys },
          },
          ORDERED_ATTRIBUTE,
          defaultConfig
        )

        // Act
        const result = sut

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given a single identity reading', () => {
    describe('when merging the reading', () => {
      it('then it merges as the whole array does', () => {
        // Arrange
        const [ancestor, local, other] = ['K B', 'B X K', 'B Y K'] as const
        const [reading] = readingsOf(ancestor, local, other)

        // Act
        const sut = mergeReading(reading!, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(formatResult(sut)).toBe(mergeFormatted(ancestor, local, other))
      })
    })
  })

  describe('given a single identity reading', () => {
    describe('when the entries are merged', () => {
      it('then no swap of interchangeable copies is counted', () => {
        // Arrange
        const sut = mergeFormatted

        // Act
        const result = sut('A B', 'X B', 'A Y')

        // Assert
        expect(result).toBe('X,Y (clean)')
      })
    })
  })

  describe('given several identity readings', () => {
    describe('when the entries are merged', () => {
      it('then the swaps of interchangeable copies decide which readings count', () => {
        // Arrange
        const sut = mergeFormatted

        // Act
        const result = sut('~a ~b', '~a ~p', '~p ~p')

        // Assert
        expect(result).toBe('~p,~p (clean)')
      })
    })
  })

  describe('given a side that equals the ancestor or the other side', () => {
    describe('when the merge starts', () => {
      it.each([
        ['local matches the ancestor', 'A B A', 'A B A', 'B A', 'B,A (clean)'],
        ['other matches the ancestor', 'A B A', 'B A', 'A B A', 'B,A (clean)'],
        [
          'both live sides match',
          'A B A*',
          'B A+ A+',
          'B A+ A+',
          'B,A+,A+ (clean)',
        ],
      ] as const)(
        'then %s and the merge takes the changed side whole',
        (_title, ancestor, local, other, expected) => {
          // Arrange
          const sut = mergeFormatted

          // Act
          const result = sut(ancestor, local, other)

          // Assert
          expect(result).toBe(expected)
        }
      )
    })
  })
})
