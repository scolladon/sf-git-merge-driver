import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { leastOf, pushAll } from '../../../src/utils/arrayUtils.js'

// A spread passes one argument per value and overflows the stack from about
// 100 000 of them: twice that leaves room for any depth the runner adds.
const MORE_VALUES_THAN_A_SPREAD_PASSES = 200_000

// Few enough values for Math.min(...values) to stand as the reference.
const GENERATED_VALUES_AT_MOST = 1_000

describe('arrayUtils', () => {
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

  describe('leastOf', () => {
    describe('given no value', () => {
      describe('when taking the least', () => {
        it('then it is positive infinity, as Math.min of no argument', () => {
          // Arrange
          const sut = leastOf

          // Act
          const result = sut([])

          // Assert
          expect(result).toBe(Number.POSITIVE_INFINITY)
        })
      })
    })

    describe('given one value', () => {
      describe('when taking the least', () => {
        it('then it is that value', () => {
          // Arrange
          const sut = leastOf

          // Act
          const result = sut([5])

          // Assert
          expect(result).toBe(5)
        })
      })
    })

    describe('given several values', () => {
      describe('when taking the least', () => {
        it('then it is the smallest of them', () => {
          // Arrange
          const sut = leastOf

          // Act
          const result = sut([3, -2, 7, 0])

          // Assert
          expect(result).toBe(-2)
        })
      })
    })

    describe('given more values than a spread can pass', () => {
      describe('when taking the least', () => {
        it('then it is the smallest of them', () => {
          // Arrange
          const values = Array.from(
            { length: MORE_VALUES_THAN_A_SPREAD_PASSES },
            (_, at) => MORE_VALUES_THAN_A_SPREAD_PASSES - at
          )
          const sut = leastOf

          // Act
          const result = sut(values)

          // Assert
          expect(result).toBe(1)
        })
      })
    })

    describe('given generated integers', () => {
      describe('when taking the least', () => {
        it('then it is what Math.min returns over their spread', () => {
          fc.assert(
            fc.property(
              fc.array(fc.integer(), { maxLength: GENERATED_VALUES_AT_MOST }),
              values => {
                // Arrange
                const sut = leastOf

                // Act
                const result = sut(values)

                // Assert
                expect(result).toBe(Math.min(...values))
              }
            )
          )
        })
      })
    })
  })
})
