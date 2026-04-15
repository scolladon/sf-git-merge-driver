import { describe, expect, it } from 'vitest'
import { hasSameOrder, lcs, pushAll } from '../../../src/utils/arrayUtils.js'

describe('arrayUtils', () => {
  describe('hasSameOrder', () => {
    it('Given identical arrays, When comparing, Then returns true', () => {
      expect(hasSameOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
    })

    it('Given same relative order with extra elements, When comparing, Then returns true', () => {
      expect(hasSameOrder(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toBe(true)
    })

    it('Given reversed order, When comparing, Then returns false', () => {
      expect(hasSameOrder(['a', 'b'], ['b', 'a'])).toBe(false)
    })

    it('Given disjoint arrays, When comparing, Then returns true', () => {
      expect(hasSameOrder(['a', 'b'], ['c', 'd'])).toBe(true)
    })

    it('Given different common element counts, When comparing, Then returns false', () => {
      expect(hasSameOrder(['a', 'b', 'c'], ['a', 'c'])).toBe(true)
      expect(hasSameOrder(['a', 'c'], ['c', 'a', 'b'])).toBe(false)
    })

    it('Given duplicates causing length mismatch, When comparing, Then returns false', () => {
      expect(hasSameOrder(['a', 'a', 'b'], ['a', 'b'])).toBe(false)
    })

    it('Given empty arrays, When comparing, Then returns true', () => {
      expect(hasSameOrder([], [])).toBe(true)
    })

    it('Given different filtered lengths, When comparing, Then returns false', () => {
      expect(hasSameOrder(['a', 'b'], ['b', 'a', 'c'])).toBe(false)
    })

    it('Given same filtered length but different order, When comparing, Then returns false', () => {
      expect(hasSameOrder(['a', 'b', 'c'], ['a', 'c', 'b'])).toBe(false)
    })
  })

  describe('lcs', () => {
    it('Given identical arrays, When computing LCS, Then returns the full array', () => {
      expect(lcs(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    })

    it('Given disjoint arrays, When computing LCS, Then returns empty', () => {
      expect(lcs(['a', 'b'], ['c', 'd'])).toEqual([])
    })

    it('Given partially overlapping arrays, When computing LCS, Then returns common subsequence', () => {
      expect(lcs(['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toEqual([
        'a',
        'c',
        'd',
      ])
    })

    it('Given empty arrays, When computing LCS, Then returns empty', () => {
      expect(lcs([], [])).toEqual([])
    })

    it('given first array empty when computing LCS then returns empty', () => {
      expect(lcs([], ['a', 'b'])).toEqual([])
    })

    it('given second array empty when computing LCS then returns empty', () => {
      expect(lcs(['a', 'b'], [])).toEqual([])
    })

    it('given single common element when computing LCS then returns it', () => {
      expect(lcs(['a'], ['a'])).toEqual(['a'])
    })

    it('given interleaved elements when computing LCS then returns correct subsequence', () => {
      // Forces the dp[i-1][j] > dp[i][j-1] branch
      expect(lcs(['a', 'x', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
    })

    it('given reversed elements when computing LCS then prefers left branch', () => {
      // Forces the dp[i-1][j] <= dp[i][j-1] branch (j-- path)
      expect(lcs(['a', 'b'], ['b', 'x', 'a'])).toEqual(['b'])
    })

    it('given equal dp values when backtracking then follows j-- path', () => {
      // Tie-breaking: when dp[i-1][j] === dp[i][j-1], should follow j--
      expect(lcs(['x', 'a'], ['y', 'a'])).toEqual(['a'])
    })

    it('given interleaved common elements when computing LCS then exercises all backtracking paths', () => {
      // Exercises diagonal (a,c match), top (skip x in a), left (skip y in b)
      const sut = lcs(['a', 'b', 'c'], ['x', 'a', 'y', 'c'])

      expect(sut).toEqual(['a', 'c'])
    })

    it('given swapped pair when computing LCS then forces left path during backtrack', () => {
      // With a=['a','b'] b=['b','a'], LCS is length 1
      // The backtracking must take the left (j--) path at some point
      const sut = lcs(['a', 'b'], ['b', 'a'])

      expect(sut).toHaveLength(1)
    })
  })

  describe('pushAll', () => {
    describe('given an empty source array', () => {
      it('should not modify target array', () => {
        // Arrange
        const target = [1, 2, 3]
        const source: number[] = []

        // Act
        pushAll(target, source)

        // Assert
        expect(target).toEqual([1, 2, 3])
      })
    })

    describe('given a non-empty source array', () => {
      it('should append all elements to target array', () => {
        // Arrange
        const target = [1, 2]
        const source = [3, 4, 5]

        // Act
        pushAll(target, source)

        // Assert
        expect(target).toEqual([1, 2, 3, 4, 5])
      })
    })

    describe('given an empty target array', () => {
      it('should populate target with source elements', () => {
        // Arrange
        const target: string[] = []
        const source = ['a', 'b', 'c']

        // Act
        pushAll(target, source)

        // Assert
        expect(target).toEqual(['a', 'b', 'c'])
      })
    })

    describe('given multiple source arrays', () => {
      it('should append all elements from all sources in order', () => {
        // Arrange
        const target = ['a']
        const source1 = ['b', 'c']
        const source2 = ['d']
        const source3 = ['e', 'f']

        // Act
        pushAll(target, source1, source2, source3)

        // Assert
        expect(target).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
      })
    })

    describe('given mixed empty and non-empty source arrays', () => {
      it('should handle empty arrays in the middle', () => {
        // Arrange
        const target = [1]
        const source1 = [2]
        const source2: number[] = []
        const source3 = [3]

        // Act
        pushAll(target, source1, source2, source3)

        // Assert
        expect(target).toEqual([1, 2, 3])
      })
    })
  })
})
