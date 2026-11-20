import { describe, expect, it, vi } from 'vitest'
import { readings } from '../../../../../src/merger/nodes/keyedReadings.js'
import { identify } from '../../../../../src/merger/nodes/ordered/identity.js'
import type { Reading } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import { readingsOf } from '../../../../utils/orderedTokens.js'

vi.mock(
  '../../../../../src/merger/nodes/keyedReadings.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../../src/merger/nodes/keyedReadings.js')
      >()
    return { ...original, readings: vi.fn(original.readings) }
  }
)

const NONE = '-'

const placed = (position: number): string =>
  position < 0 ? NONE : String(position)

// key@ancestor,local,other positions of every entry, in id order
const shapeOf = (reading: Reading): string =>
  reading
    .map(
      e =>
        `${e.key}@${placed(e.ancestorPos)},${placed(e.localPos)},${placed(e.otherPos)}`
    )
    .join(' ')

describe('identify', () => {
  describe('given sides whose keys are unique', () => {
    it('then it reads one entry per key at the written positions', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B C', 'B A C', 'A C B')

      // Assert
      expect(result.map(shapeOf)).toEqual(['A@0,1,0 B@1,0,2 C@2,2,1'])
    })
  })

  describe('given a key held at most once on every side', () => {
    it('then no pairing is enumerated', () => {
      // Arrange
      const sut = readingsOf

      // Act
      sut('A B', 'A B', 'A B')

      // Assert
      expect(readings).not.toHaveBeenCalled()
    })
  })

  describe.each([
    ['one side adds a key', 'A', 'A X', 'A', 'A@0,0,0 X@-,1,-'],
    ['both sides add the same key', '', 'X', 'X', 'X@-,0,0'],
  ])('given %s', (_title, ancestor, local, other, expected) => {
    it('then the added key is one entry', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.map(shapeOf)).toEqual([expected])
    })
  })

  describe('given a key repeated on the ancestor and edited on one side', () => {
    it('then every pairing of its copies is a reading', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A', 'A*')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        [
          'A@0,0,0 A@2,-,- B@1,-,-',
          'A@0,0,- A@2,-,0 B@1,-,-',
          'A@0,-,0 A@2,0,- B@1,-,-',
          'A@0,-,- A@2,0,0 B@1,-,-',
        ].sort()
      )
    })
  })

  describe('given a value both sides hold that a reading would lose', () => {
    it('then only the readings pairing it on both sides remain', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A B', 'B A')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        ['A@0,0,1 A@2,-,- B@1,1,0', 'A@0,-,- A@2,0,1 B@1,1,0'].sort()
      )
    })
  })

  describe('given readings that differ in the moves they fabricate', () => {
    it('then only the readings with the fewest moves remain', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('A B A', 'A B', 'A* B A')

      // Assert
      expect(result.map(shapeOf)).toEqual(['A@0,0,0 A@2,-,2 B@1,1,1'])
    })
  })

  describe.each([
    [
      'a side adds a new key next to a repeated one',
      'A B A',
      'A',
      'A X',
      ['A@0,0,0 A@2,-,- B@1,-,- X@-,-,1', 'A@0,-,- A@2,0,0 B@1,-,- X@-,-,1'],
    ],
    [
      'a rotation of distinct keys around a repeated one',
      'A B C A',
      'A B C',
      'C A B',
      ['A@0,0,1 A@3,-,- B@1,1,2 C@2,2,0'],
    ],
    [
      'keyless entries',
      '~a ~a ~b',
      '~a ~b',
      '~a ~a ~b*',
      [
        '~a@0,0,0 ~a@1,-,1 ~b@2,1,- ~b*@-,-,2',
        '~a@0,-,0 ~a@1,0,1 ~b@2,1,- ~b*@-,-,2',
      ],
    ],
  ])('given %s', (_title, ancestor, local, other, expected) => {
    it('then it reads the expected pairings', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.map(shapeOf).sort()).toEqual([...expected].sort())
    })
  })

  describe.each([
    ['the ancestor', 'A A', 'A', 'A'],
    ['the local side', 'A', 'A A', 'A'],
    ['the other side', 'A', 'A', 'A A'],
  ])('given a key repeated on only %s', (_title, ancestor, local, other) => {
    it('then every copy is an entry', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut(ancestor, local, other)

      // Assert
      expect(result.every(reading => reading.length === 2)).toBe(true)
    })
  })

  describe('given no ancestor and readings tied on moves', () => {
    it('then every tied reading remains', () => {
      // Arrange
      const sut = readingsOf

      // Act
      const result = sut('', 'A C C', 'C')

      // Assert
      expect(result.map(shapeOf).sort()).toEqual(
        ['A@-,0,- C@-,1,0 C@-,2,-', 'A@-,0,- C@-,2,0 C@-,1,-'].sort()
      )
    })
  })
  describe('given thousands of unique keys', () => {
    // Linear code takes ~100 ms at SIZE under coverage; the per-pair version
    // took ~17 s plain. The budget sits between the two so that CPU load and
    // coverage instrumentation cannot push the linear code over it.
    const SIZE = 16_000
    const BUDGET_MS = 1400
    const QUADRATIC_GUARD_TIMEOUT_MS = 120_000
    const tokens = Array.from({ length: SIZE }, (_, i) => `V${i}`)
    const timed = (ancestor: string, local: string, other: string): number => {
      const start = performance.now()
      readingsOf(ancestor, local, other)
      return performance.now() - start
    }

    it(
      'then identical sides are identified within the budget',
      () => {
        // Arrange
        const text = tokens.join(' ')

        // Act
        const elapsed = timed(text, text, text)

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )

    it(
      'then one-sided edits are identified within the budget',
      () => {
        // Arrange
        const text = tokens.join(' ')
        const edited = tokens.map((t, i) => (i % 2 ? t : `${t}x`)).join(' ')

        // Act
        const elapsed = timed(text, edited, text)

        // Assert
        expect(elapsed).toBeLessThan(BUDGET_MS)
      },
      QUADRATIC_GUARD_TIMEOUT_MS
    )
  })

  describe.each([
    ['key order', { a: '1', b: '2' }, { b: '2', a: '1' }, 1],
    [
      'nested key order',
      { a: { x: '1', y: '2' } },
      { a: { y: '2', x: '1' } },
      1,
    ],
    ['array elements', { a: ['1', '2'] }, { a: ['1', '2'] }, 1],
    ['null members', { a: null }, { a: null }, 1],
    ['array order', { a: ['1', '2'] }, { a: ['2', '1'] }, 2],
    ['array against object', { a: ['1'] }, { a: { 0: '1' } }, 2],
    ['string against object', { a: 'ab' }, { a: { 0: 'a', 1: 'b' } }, 2],
    ['null against object', { a: null }, { a: {} }, 2],
  ])(
    'given a value held by both sides differing by %s',
    (_title, held, twin, count) => {
      it('then the value counts as held only when the sides carry equal ones', () => {
        // Arrange
        const keys = { ancestor: [], local: ['K', 'K'], other: ['K'] }

        // Act
        const result = identify([], [{ a: 'x' }, held], [twin], keys)

        // Assert
        expect(result).toHaveLength(count)
      })
    }
  )

  describe('given a value that only the other side of a shared entry carries', () => {
    it('then that entry keeps the value held', () => {
      // Arrange
      const v = (a: string) => ({ a })
      const keys = {
        ancestor: ['M', 'K'],
        local: ['L', 'L', 'K'],
        other: ['L', 'K'],
      }

      // Act
      const result = identify(
        [v('2'), v('2')],
        [v('1'), v('2'), v('1')],
        [v('3'), v('2')],
        keys
      )

      // Assert
      expect(result.map(shapeOf)).toEqual([
        'M@0,-,- K@1,2,1 L@-,0,0 L@-,1,-',
        'M@0,-,- K@1,2,1 L@-,1,0 L@-,0,-',
      ])
    })
  })

  describe('given a held value spelled with another key order on one side', () => {
    it('then only the readings keeping it remain', () => {
      // Arrange
      const local = (a: string) => ({ a, b: 'z' })
      const other = (a: string) => ({ b: 'z', a })
      const keys = {
        ancestor: ['L', 'M', 'M'],
        local: ['K', 'K', 'M'],
        other: ['M'],
      }

      // Act
      const result = identify(
        [local('3'), local('1'), local('1')],
        [local('2'), local('1'), local('1')],
        [other('1')],
        keys
      )

      // Assert
      expect(result.map(shapeOf)).toEqual([
        'L@0,-,- M@1,2,0 M@2,-,- K@-,0,- K@-,1,-',
        'L@0,-,- M@1,-,- M@2,2,0 K@-,0,- K@-,1,-',
      ])
    })
  })
})
