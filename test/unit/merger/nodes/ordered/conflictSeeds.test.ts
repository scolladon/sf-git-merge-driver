import { describe, expect, it } from 'vitest'
import {
  ConflictSeeds,
  completeJoin,
  NO_MARKS,
  UnionFind,
} from '../../../../../src/merger/nodes/ordered/conflictSeeds.js'

describe('UnionFind', () => {
  describe('given ids never united', () => {
    it('then each id is its own class', () => {
      // Arrange
      const sut = new UnionFind(3)

      // Act
      const result = [0, 1, 2].map(id => sut.find(id))

      // Assert
      expect(result).toEqual([0, 1, 2])
    })
  })

  describe('given two ids united', () => {
    it('then they share a class and the first joins the second root', () => {
      // Arrange
      const sut = new UnionFind(3)

      // Act
      sut.union(0, 1)

      // Assert
      expect(sut.find(0)).toBe(1)
      expect(sut.find(1)).toBe(1)
      expect(sut.find(2)).toBe(2)
    })
  })

  describe('given a chain of unions', () => {
    it('then the whole chain collapses to one class', () => {
      // Arrange
      const sut = new UnionFind(4)

      // Act
      sut.union(0, 1)
      sut.union(1, 2)
      sut.union(2, 3)

      // Assert
      expect([0, 1, 2, 3].map(id => sut.find(id))).toEqual([3, 3, 3, 3])
    })
  })

  describe('given ids already in one class', () => {
    it('then uniting them again changes nothing', () => {
      // Arrange
      const sut = new UnionFind(3)
      sut.union(0, 1)

      // Act
      sut.union(1, 0)

      // Assert
      expect([0, 1, 2].map(id => sut.find(id))).toEqual([1, 1, 2])
    })
  })
})

describe('ConflictSeeds', () => {
  describe('given no marks applied', () => {
    it('then nothing is seeded', () => {
      // Arrange
      const sut = new ConflictSeeds(3)

      // Act
      sut.apply(NO_MARKS)

      // Assert
      expect(sut.hasSeeds()).toBe(false)
      expect(sut.isSeeded(0)).toBe(false)
      expect(NO_MARKS).toEqual({ joins: [], seeds: [] })
    })
  })

  describe('given a join', () => {
    it('then both ends are seeded and share a root', () => {
      // Arrange
      const sut = new ConflictSeeds(4)

      // Act
      sut.apply({ joins: [[0, 2]], seeds: [] })

      // Assert
      expect(sut.isSeeded(0)).toBe(true)
      expect(sut.isSeeded(2)).toBe(true)
      expect(sut.isSeeded(1)).toBe(false)
      expect(sut.root(0)).toBe(sut.root(2))
      expect(sut.hasSeeds()).toBe(true)
    })
  })

  describe('given a listed seed', () => {
    it('then only that id is seeded', () => {
      // Arrange
      const sut = new ConflictSeeds(3)

      // Act
      sut.apply({ joins: [], seeds: [1] })

      // Assert
      expect(sut.isSeeded(1)).toBe(true)
      expect(sut.isSeeded(0)).toBe(false)
      expect(sut.root(1)).toBe(1)
    })
  })

  describe('given a direct join', () => {
    it('then it seeds both ends', () => {
      // Arrange
      const sut = new ConflictSeeds(3)

      // Act
      sut.join(1, 2)

      // Assert
      expect(sut.isSeeded(1)).toBe(true)
      expect(sut.isSeeded(2)).toBe(true)
      expect(sut.root(1)).toBe(sut.root(2))
    })
  })
})

describe('completeJoin', () => {
  const componentsOf = (
    first: readonly number[],
    second: readonly number[]
  ): number[][] => {
    const classes = new UnionFind(8)
    for (const [a, b] of completeJoin(first, second)) classes.union(a, b)
    const ids = [...first, ...second]
    return [...new Set(ids.map(id => classes.find(id)))].map(root =>
      ids.filter(id => classes.find(id) === root).sort()
    )
  }

  describe('given an empty list on either side', () => {
    it.each([
      [[], [1, 2]],
      [[1, 2], []],
    ])('then %j and %j join nothing', (first, second) => {
      // Arrange
      const sut = completeJoin

      // Act
      const result = sut(first, second)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('given one id on each side', () => {
    it('then they are joined once', () => {
      // Arrange
      const sut = completeJoin

      // Act
      const result = sut([1], [2])

      // Assert
      expect(result).toEqual([[1, 2]])
    })
  })

  describe('given several ids on each side', () => {
    it('then every id ends in one class', () => {
      // Arrange
      const sut = componentsOf

      // Act
      const result = sut([1, 2, 3], [4, 5])

      // Assert
      expect(result).toEqual([[1, 2, 3, 4, 5]])
    })

    it('then the number of joins grows linearly', () => {
      // Arrange
      const sut = completeJoin

      // Act
      const result = sut([1, 2, 3], [4, 5])

      // Assert
      expect(result).toHaveLength(4)
    })
  })
})
