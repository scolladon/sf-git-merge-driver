import { describe, expect, it } from 'vitest'
import {
  buildEarlyResult,
  combineResults,
  isNonEmpty,
  noConflict,
  withConflict,
  wrapWithRootKey,
} from '../../../src/types/mergeResult.js'

describe('mergeResult', () => {
  describe('noConflict', () => {
    it('should create a result with hasConflict false', () => {
      // Arrange
      const output = [{ field: 'value' }]

      // Act
      const result = noConflict(output)

      // Assert
      expect(result.output).toEqual(output)
      expect(result.hasConflict).toBe(false)
    })

    it('should handle empty output', () => {
      // Arrange
      const output: never[] = []

      // Act
      const result = noConflict(output)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('given empty output when called twice then returns same reference', () => {
      // Act
      const result1 = noConflict([])
      const result2 = noConflict([])

      // Assert
      expect(result1).toBe(result2)
    })
  })

  describe('withConflict', () => {
    it('should create a result with hasConflict true', () => {
      // Arrange
      const output = [{ field: 'value' }]

      // Act
      const result = withConflict(output)

      // Assert
      expect(result.output).toEqual(output)
      expect(result.hasConflict).toBe(true)
    })

    it('should handle empty output', () => {
      // Arrange
      const output: never[] = []

      // Act
      const result = withConflict(output)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('combineResults', () => {
    it('should combine outputs from multiple results', () => {
      // Arrange
      const results = [
        noConflict([{ a: 1 }]),
        noConflict([{ b: 2 }]),
        noConflict([{ c: 3 }]),
      ]

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.output).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
    })

    it('should set hasConflict to true if any result has conflict', () => {
      // Arrange
      const results = [
        noConflict([{ a: 1 }]),
        withConflict([{ b: 2 }]),
        noConflict([{ c: 3 }]),
      ]

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.hasConflict).toBe(true)
    })

    it('should set hasConflict to false if no result has conflict', () => {
      // Arrange
      const results = [
        noConflict([{ a: 1 }]),
        noConflict([{ b: 2 }]),
        noConflict([{ c: 3 }]),
      ]

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.hasConflict).toBe(false)
    })

    it('should handle empty results array', () => {
      // Arrange
      const results: ReturnType<typeof noConflict>[] = []

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.output).toEqual([])
      expect(combined.hasConflict).toBe(false)
    })

    it('given single result when combining then returns same reference', () => {
      // Arrange
      const single = noConflict([{ a: 1 }])

      // Act
      const combined = combineResults([single])

      // Assert
      expect(combined).toBe(single)
    })

    it('should flatten nested arrays from outputs', () => {
      // Arrange
      const results = [noConflict([{ a: 1 }, { b: 2 }]), noConflict([{ c: 3 }])]

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.output).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
    })
  })

  describe('wrapWithRootKey', () => {
    it('given non-empty output when wrapping then wraps under key preserving conflict', () => {
      // Arrange
      const sut = withConflict([{ field: 'value' }])

      // Act
      const result = wrapWithRootKey(sut, 'root')

      // Assert
      expect(result.output).toEqual([{ root: [{ field: 'value' }] }])
      expect(result.hasConflict).toBe(true)
    })

    it('given empty output when wrapping then returns noConflict with empty array under key', () => {
      // Arrange
      const sut = noConflict([])

      // Act
      const result = wrapWithRootKey(sut, 'root')

      // Assert
      expect(result.output).toEqual([{ root: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('given non-empty output without conflict when wrapping then preserves hasConflict false', () => {
      // Arrange
      const sut = noConflict([{ field: 'value' }])

      // Act
      const result = wrapWithRootKey(sut, 'root')

      // Assert
      expect(result.output).toEqual([{ root: [{ field: 'value' }] }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('buildEarlyResult', () => {
    it('given value without rootKeyName when building then returns content as-is', () => {
      // Arrange
      const sut = [{ a: 1 }]

      // Act
      const result = buildEarlyResult(sut)

      // Assert
      expect(result.output).toEqual([{ a: 1 }])
      expect(result.hasConflict).toBe(false)
    })

    it('given value with rootKeyName when building then wraps under key', () => {
      // Arrange
      const sut = [{ a: 1 }]

      // Act
      const result = buildEarlyResult(sut, 'root')

      // Assert
      expect(result.output).toEqual([{ root: [{ a: 1 }] }])
      expect(result.hasConflict).toBe(false)
    })

    it('given null value when building then returns empty array', () => {
      // Arrange & Act
      const result = buildEarlyResult(null as unknown as never)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('given null value with rootKeyName when building then wraps empty under key', () => {
      // Arrange & Act
      const result = buildEarlyResult(null as unknown as never, 'root')

      // Assert
      expect(result.output).toEqual([{ root: [] }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('isNonEmpty', () => {
    it('Given result with output, When checking, Then returns true', () => {
      // Arrange
      const result = noConflict([{ a: 1 }])

      // Act & Assert
      expect(isNonEmpty(result)).toBe(true)
    })

    it('Given result with conflict and no output, When checking, Then returns true', () => {
      // Arrange
      const result = withConflict([])

      // Act & Assert
      expect(isNonEmpty(result)).toBe(true)
    })

    it('Given empty result without conflict, When checking, Then returns false', () => {
      // Arrange
      const result = noConflict([])

      // Act & Assert
      expect(isNonEmpty(result)).toBe(false)
    })
  })
})
