import { describe, expect, it } from 'vitest'
import { inCanonicalOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'

describe('inCanonicalOrder', () => {
  describe('given tags with fullName among them', () => {
    it('when ordering then fullName comes first, the others by code point', () => {
      // Arrange
      const tags = ['label', 'fullName', 'Zeta', 'alpha']

      // Act
      const sut = inCanonicalOrder(tags)

      // Assert
      expect(sut).toEqual(['fullName', 'Zeta', 'alpha', 'label'])
    })
  })

  describe('given tags a locale-aware sort would place differently', () => {
    it('when ordering then upper case precedes lower case and the input is left alone', () => {
      // Arrange
      const tags = ['b', 'B', 'a', 'A']

      // Act
      const sut = inCanonicalOrder(tags)

      // Assert
      expect(sut).toEqual(['A', 'B', 'a', 'b'])
      expect(tags).toEqual(['b', 'B', 'a', 'A'])
    })
  })

  describe('given a tag that merely starts like fullName', () => {
    it('when ordering then it takes its code point place', () => {
      // Arrange
      const tags = ['fullNameX', 'fullName', 'a']

      // Act
      const sut = inCanonicalOrder(tags)

      // Assert
      expect(sut).toEqual(['fullName', 'a', 'fullNameX'])
    })
  })
})
