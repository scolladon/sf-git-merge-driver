import { describe, expect, it } from 'vitest'
import {
  groupByKey,
  matchings,
  readings,
  valueClasses,
} from '../../../../src/merger/nodes/keyedReadings.js'
import type { JsonObject } from '../../../../src/types/jsonTypes.js'

const listed =
  <Args extends unknown[], Item>(stream: (...args: Args) => Iterable<Item>) =>
  (...args: Args): Item[] => [...stream(...args)]

const entry = (name: string, extra = ''): JsonObject => ({
  name,
  extra,
})

describe('matchings', () => {
  describe('given one identical copy on each side', () => {
    it('then there is one pairing', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0], [0])

      // Assert
      expect(result).toEqual([[[0, 0]]])
    })
  })

  describe('given the side holds fewer identical copies', () => {
    it('then each ancestor copy is a reading', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0, 0], [0])

      // Assert
      expect(result).toEqual([[[0, 0]], [[1, 0]]])
    })
  })

  describe('given two identical copies on each side', () => {
    it('then the copies never cross', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0, 0], [0, 0])

      // Assert
      expect(result).toEqual([
        [
          [0, 0],
          [1, 1],
        ],
      ])
    })
  })

  describe('given more ancestor copies than side copies', () => {
    it('then the copy left behind below the floor is never a reading', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0, 0, 0], [0, 0])

      // Assert
      expect(result).toEqual([
        [
          [0, 0],
          [1, 1],
        ],
        [
          [0, 0],
          [2, 1],
        ],
        [
          [1, 0],
          [2, 1],
        ],
      ])
    })
  })

  describe('given non identical copies', () => {
    it('then each remaining ancestor copy is a reading', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0, 1], [2])

      // Assert
      expect(result).toEqual([[[0, 0]], [[1, 0]]])
    })
  })

  describe('given an identical and a non identical copy', () => {
    it('then identical copies pair before the others', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([0, 1], [2, 1])

      // Assert
      expect(result).toEqual([
        [
          [1, 1],
          [0, 0],
        ],
      ])
    })
  })

  describe('given no ancestor copy', () => {
    it('then the only pairing is empty', () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut([], [0, 1])

      // Assert
      expect(result).toEqual([[]])
    })
  })
})

describe('matchings of many identical copies', () => {
  const COPIES = 24
  const BUDGET_MS = 2000
  const identical = (count: number): number[] => Array(count).fill(0)

  describe('given as many identical copies on the side as on the ancestor', () => {
    it('then the only pairing is the one in order, found without exploring the others', {
      timeout: BUDGET_MS,
    }, () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut(identical(COPIES), identical(COPIES))

      // Assert
      expect(result).toEqual([
        identical(COPIES).map((_, index) => [index, index]),
      ])
    })
  })

  describe('given one identical copy less on the side', () => {
    it('then each copy the side dropped is one pairing', {
      timeout: BUDGET_MS,
    }, () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut(identical(COPIES), identical(COPIES - 1))

      // Assert
      expect(result).toHaveLength(COPIES)
    })
  })

  describe('given more identical copies on the side than on the ancestor', () => {
    it('then the ancestor copies pair in order and the surplus stays unpaired', {
      timeout: BUDGET_MS,
    }, () => {
      // Arrange
      const sut = listed(matchings)

      // Act
      const result = sut(identical(2), identical(COPIES))

      // Assert
      expect(result).toEqual([
        [
          [0, 0],
          [1, 1],
        ],
      ])
    })
  })
})

describe('valueClasses', () => {
  describe('given equal objects written with a different key order', () => {
    it('then they share one class', () => {
      // Arrange
      const sut = valueClasses

      // Act
      const result = sut([{ a: 1, b: 2 }, { c: 3 }, { b: 2, a: 1 }])

      // Assert
      expect(result).toEqual([0, 1, 0])
    })
  })
})

describe('groupByKey', () => {
  describe('given a repeated key', () => {
    it('then every copy is kept in written order', () => {
      // Arrange
      const first = entry('a', '1')
      const second = entry('a', '2')
      const third = entry('b')
      const sut = groupByKey

      // Act
      const result = sut([], [first, third, second], [third], {
        ancestor: [],
        local: ['a', 'b', 'a'],
        other: ['b'],
      })

      // Assert
      expect([...result.keys()]).toEqual(['a', 'b'])
      expect(result.get('a')).toEqual({
        ancestor: [],
        local: [first, second],
        other: [],
      })
      expect(result.get('b')).toEqual({
        ancestor: [],
        local: [third],
        other: [third],
      })
    })
  })

  describe('given keys first seen on the ancestor then local then other', () => {
    it('then the groups follow that order', () => {
      // Arrange
      const sut = groupByKey

      // Act
      const result = sut([entry('z')], [entry('y')], [entry('x')], {
        ancestor: ['z'],
        local: ['y'],
        other: ['x'],
      })

      // Assert
      expect([...result.keys()]).toEqual(['z', 'y', 'x'])
    })
  })
})

describe('readings', () => {
  const a = entry('a')
  const edited = entry('a', 'edited')

  describe('given two ancestor copies, one local copy and an edited other copy', () => {
    it('then there are four pairings sets', () => {
      // Arrange
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [a, a], local: [a], other: [edited] })

      // Assert
      expect(result).toEqual([
        [{ ancestor: a, local: a, other: edited }, { ancestor: a }],
        [
          { ancestor: a, local: a },
          { ancestor: a, other: edited },
        ],
        [
          { ancestor: a, other: edited },
          { ancestor: a, local: a },
        ],
        [{ ancestor: a }, { ancestor: a, local: a, other: edited }],
      ])
    })
  })

  describe('given no ancestor, one local copy and two other copies', () => {
    it('then the local copy pairs with either other copy', () => {
      // Arrange
      const first = entry('a', '1')
      const second = entry('a', '2')
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [], local: [a], other: [first, second] })

      // Assert
      expect(result).toEqual([
        [{ local: a, other: first }, { other: second }],
        [{ local: a, other: second }, { other: first }],
      ])
    })
  })

  describe('given no ancestor, two local copies and one other copy', () => {
    it('then the other copy pairs with either local copy', () => {
      // Arrange
      const first = entry('a', '1')
      const second = entry('a', '2')
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [], local: [first, second], other: [a] })

      // Assert
      expect(result).toEqual([
        [{ local: first, other: a }, { local: second }],
        [{ local: second, other: a }, { local: first }],
      ])
    })
  })

  describe('given as many local copies as other copies with no ancestor', () => {
    it('then the pairs follow the order of the other copies', () => {
      // Arrange
      const b = entry('b')
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [], local: [b, a], other: [a, b] })

      // Assert
      expect(result).toEqual([
        [
          { local: a, other: a },
          { local: b, other: b },
        ],
      ])
    })
  })

  describe('given a single copy on each side', () => {
    it('then there is one reading', () => {
      // Arrange
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [a], local: [a], other: [a] })

      // Assert
      expect(result).toEqual([[{ ancestor: a, local: a, other: a }]])
    })
  })

  describe('given copies only on the local and the other side', () => {
    it('then local-only and other-only copies follow the pairs', () => {
      // Arrange
      const sut = listed(readings)

      // Act
      const result = sut({
        ancestor: [],
        local: [a, edited],
        other: [a],
      })

      // Assert
      expect(result).toEqual([[{ local: a, other: a }, { local: edited }]])
    })
  })

  describe('given a local copy beyond the one the ancestor holds', () => {
    it('then it stays a local-only copy next to the matched one', () => {
      // Arrange
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [a], local: [a, edited], other: [a] })

      // Assert
      expect(result).toEqual([
        [{ ancestor: a, local: a, other: a }, { local: edited }],
      ])
    })
  })

  describe('given a pairing hidden behind the other side only', () => {
    it('then other-only copies are listed last', () => {
      // Arrange
      const sut = listed(readings)

      // Act
      const result = sut({ ancestor: [], local: [], other: [a] })

      // Assert
      expect(result).toEqual([[{ other: a }]])
    })
  })
})
