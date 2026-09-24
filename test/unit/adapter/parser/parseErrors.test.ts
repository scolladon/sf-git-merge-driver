import { describe, expect, it } from 'vitest'
import {
  UNTERMINATED_COMMENT,
  UNTERMINATED_DECLARATION,
  UNTERMINATED_PROCESSING_INSTRUCTION,
  UNTERMINATED_TAG,
  unbalancedTags,
  unexpectedCloseTag,
} from '../../../../src/adapter/parser/parseErrors.js'

describe('parseErrors', () => {
  describe('given the balance-family constant messages', () => {
    it('when read then they match the previous parser wording', () => {
      // Arrange / Act / Assert
      expect(UNTERMINATED_COMMENT).toBe('XML parse error: unterminated comment')
      expect(UNTERMINATED_DECLARATION).toBe(
        'XML parse error: unterminated <! ... >'
      )
      expect(UNTERMINATED_PROCESSING_INSTRUCTION).toBe(
        'XML parse error: unterminated <? ?>'
      )
      expect(UNTERMINATED_TAG).toBe('XML parse error: unterminated tag')
    })
  })

  describe('given a final open-frame depth', () => {
    it('when unbalancedTags then it builds the depth message', () => {
      // Arrange
      const finalDepth = 2

      // Act
      const message = unbalancedTags(finalDepth)

      // Assert
      expect(message).toBe('XML parse error: tags unbalanced (final depth 2)')
    })
  })

  describe('given a mismatched close tag on the first line', () => {
    it('when unexpectedCloseTag then it reports line 0', () => {
      // Arrange
      const xml = '<a></b>'

      // Act
      const message = unexpectedCloseTag(xml, 6)

      // Assert
      expect(message).toBe('Unexpected close tag\nLine: 0\nColumn: 7\nChar: >')
    })
  })

  describe('given a mismatched close tag on a later line', () => {
    it('when unexpectedCloseTag then it counts the newlines before it', () => {
      // Arrange
      const xml = '<a>\n<b>\n</c>'

      // Act
      const message = unexpectedCloseTag(xml, 11)

      // Assert
      expect(message).toBe('Unexpected close tag\nLine: 2\nColumn: 4\nChar: >')
    })
  })

  describe('given a CR on the mismatched close tag line', () => {
    it('when unexpectedCloseTag then the CR is counted in the column', () => {
      // Arrange
      const xml = '<a>\n</b\r>'

      // Act
      const message = unexpectedCloseTag(xml, 8)

      // Assert
      expect(message).toBe('Unexpected close tag\nLine: 1\nColumn: 5\nChar: >')
    })
  })

  describe('given a CDATA section on the mismatched close tag line', () => {
    it('when unexpectedCloseTag then it counts the input as written', () => {
      // Arrange — no rewrite runs ahead of the scan, so
      // the column points into the file the user wrote.
      const xml = '<a><![CDATA[1\n2]]><bb></b></a>'

      // Act
      const message = unexpectedCloseTag(xml, 25)

      // Assert
      expect(message).toBe('Unexpected close tag\nLine: 1\nColumn: 12\nChar: >')
    })
  })
})
