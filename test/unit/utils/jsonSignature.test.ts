import { describe, expect, it } from 'vitest'
import { signatureOf } from '../../../src/utils/jsonSignature.js'

describe('signatureOf', () => {
  describe('given values that differ only by the order of their keys', () => {
    it('when signed then they share one signature', () => {
      // Arrange
      const sut = signatureOf

      // Act
      const result = [
        sut({ b: 1, a: { d: 2, c: 3 } }),
        sut({ a: { c: 3, d: 2 }, b: 1 }),
      ]

      // Assert
      expect(result[0]).toBe(result[1])
      expect(result[0]).toBe('{"a":{"c":3,"d":2},"b":1}')
    })
  })

  describe('given a null and an array inside an object', () => {
    it('when signed then they are written as they stand', () => {
      // Arrange
      const sut = signatureOf

      // Act
      const result = sut({ b: null, a: [{ y: 1, x: 2 }] })

      // Assert
      expect(result).toBe('{"a":[{"x":2,"y":1}],"b":null}')
    })
  })
})
