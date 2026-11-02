import { describe, expect, it } from 'vitest'
import {
  isNameStartChar,
  trimXmlWhitespace,
} from '../../../../src/adapter/parser/charCodes.js'

describe('isNameStartChar', () => {
  describe.each([
    ['the last ASCII character', 127, false],
    ['the first non-ASCII character', 128, true],
    ['a letter', 'a'.charCodeAt(0), true],
    ['an underscore', '_'.charCodeAt(0), true],
    ['a colon', ':'.charCodeAt(0), true],
    ['a digit', '1'.charCodeAt(0), false],
  ])('given %s', (_, charCode, expected) => {
    it('when asked then it matches the expectation', () => {
      // Act
      const sut = isNameStartChar(charCode)

      // Assert
      expect(sut).toBe(expected)
    })
  })
})

describe('trimXmlWhitespace', () => {
  describe.each([
    ['', ''],
    [' \t\r\n ', ''],
    ['  a b \n', 'a b'],
    ['a', 'a'],
    [' a ', ' a '],
  ])('given %j', (text, expected) => {
    it('when trimmed then only the four XML whitespace characters go', () => {
      // Act
      const sut = trimXmlWhitespace(text)

      // Assert
      expect(sut).toBe(expected)
    })
  })
})
