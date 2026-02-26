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

    it('Given empty arrays, When comparing, Then returns true', () => {
      expect(hasSameOrder([], [])).toBe(true)
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
