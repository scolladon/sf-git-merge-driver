import {
  combineResults,
  noConflict,
  withConflict,
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

    it('should flatten nested arrays from outputs', () => {
      // Arrange
      const results = [noConflict([{ a: 1 }, { b: 2 }]), noConflict([{ c: 3 }])]

      // Act
      const combined = combineResults(results)

      // Assert
      expect(combined.output).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
    })
  })
})
