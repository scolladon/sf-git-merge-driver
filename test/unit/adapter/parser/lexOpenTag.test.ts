import { describe, expect, it } from 'vitest'
import { lexOpenTag } from '../../../../src/adapter/parser/lexOpenTag.js'

describe('lexOpenTag', () => {
  describe('given a tag with no attributes', () => {
    it('when lexOpenTag then it returns the name and empty attrs', () => {
      // Arrange
      const xml = '<a>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toEqual({
        kind: 'tag',
        name: 'a',
        attrs: {},
        hasAttrs: false,
        end: 3,
        selfClosing: false,
        strayQuote: false,
      })
    })

    it('when lexOpenTag then attrs is a null-prototype record', () => {
      // Arrange
      const xml = '<a>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      if (sut.kind !== 'tag') throw new Error('expected a tag')
      expect(Object.getPrototypeOf(sut.attrs)).toBeNull()
    })
  })

  describe('given a self-closing tag with no attributes', () => {
    it('when lexOpenTag then selfClosing is true', () => {
      // Arrange
      const xml = '<a/>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'a', selfClosing: true, end: 4 })
    })
  })

  describe('given a self-closing tag with whitespace before the slash', () => {
    it('when lexOpenTag then selfClosing is still true', () => {
      // Arrange
      const xml = '<a />'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'a', selfClosing: true, end: 5 })
    })
  })

  describe('given a self-closing tag with an unquoted value', () => {
    it('when lexOpenTag then the value and selfClosing both read', () => {
      // Arrange
      const xml = '<b x=1/>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({
        name: 'b',
        attrs: { x: '1' },
        selfClosing: true,
        end: 8,
      })
    })
  })

  describe('given a tag ending in `?>`', () => {
    it('when lexOpenTag then it is not self-closing', () => {
      // Arrange — the old parser self-closed here; the scanner drops that.
      const xml = '<b x="1"?>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({
        name: 'b',
        attrs: { x: '1' },
        selfClosing: false,
        end: 10,
      })
    })
  })

  describe('given a name that itself holds a trailing `?`', () => {
    it('when lexOpenTag then the `?` stays part of the name', () => {
      // Arrange
      const xml = '<b?>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'b?', selfClosing: false, end: 4 })
    })
  })

  describe('given an attribute name starting with a digit', () => {
    it('when lexOpenTag then the digit is skipped', () => {
      // Arrange
      const xml = '<a 1x="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' }, hasAttrs: true })
    })
  })

  describe('given an attribute name shadowing __proto__', () => {
    it('when lexOpenTag then only an ASCII letter starts the name', () => {
      // Arrange
      const xml = '<a __proto__="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { proto__: '1' } })
    })
  })

  describe('given a newline splitting the element name from its attributes', () => {
    it('when lexOpenTag then the name stops at the newline', () => {
      // Arrange
      const xml = '<a\ny="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'a', attrs: { y: '1' } })
    })
  })

  describe('given a tab splitting the element name from its attributes', () => {
    it('when lexOpenTag then the name stops at the tab', () => {
      // Arrange
      const xml = '<a\tx="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'a', attrs: { x: '1' } })
    })
  })

  describe('given a carriage return terminating an attribute name', () => {
    it('when lexOpenTag then the CR is skipped before `=`', () => {
      // Arrange
      const xml = '<a x\r="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' } })
    })
  })

  describe('given a newline terminating an attribute name', () => {
    it('when lexOpenTag then the newline is skipped before `=`', () => {
      // Arrange
      const xml = '<a x\n="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' } })
    })
  })

  describe('given whitespace around `=`', () => {
    it('when lexOpenTag then it is skipped on both sides', () => {
      // Arrange
      const xml = '<a x = "1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' } })
    })
  })

  describe('given a tab around `=`', () => {
    it('when lexOpenTag then it is skipped on both sides', () => {
      // Arrange
      const xml = '<a x\t=\t"1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' } })
    })
  })

  describe('given attribute names at the ASCII-letter range boundaries', () => {
    it('when lexOpenTag then only A-Z and a-z start an attribute', () => {
      // Arrange — 'A', 'Z', 'a', 'z' sit exactly on the isAsciiLetter
      // boundaries; '{' sits one past 'z' and must stay a skipped char.
      const xml = '<a A="1" Z="2" a="3" z="4" {x="5">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({
        attrs: { A: '1', Z: '2', a: '3', z: '4', x: '5' },
      })
    })
  })

  describe('given a single-quoted attribute value', () => {
    it('when lexOpenTag then it reads like a double-quoted one', () => {
      // Arrange
      const xml = "<b x='1'>"

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1' } })
    })
  })

  describe('given an unquoted attribute value', () => {
    it('when lexOpenTag then it reads to the next stop', () => {
      // Arrange
      const xml = '<a x=1 y=2>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: '1', y: '2' } })
    })
  })

  describe('given a valueless attribute', () => {
    it('when lexOpenTag then its value is null', () => {
      // Arrange
      const xml = '<a x>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: null } })
    })
  })

  describe('given `=` immediately followed by `>`', () => {
    it('when lexOpenTag then the value is null', () => {
      // Arrange
      const xml = '<a x=>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { x: null }, strayQuote: false })
    })
  })

  describe('given a duplicate attribute', () => {
    it('when lexOpenTag then the last value wins at the first position', () => {
      // Arrange
      const xml = '<a x="1" y="2" x="3">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      if (sut.kind !== 'tag') throw new Error('expected a tag')
      expect(Object.keys(sut.attrs)).toEqual(['x', 'y'])
      expect(sut.attrs['x']).toBe('3')
    })
  })

  describe('given an unterminated quoted value', () => {
    it('when lexOpenTag then it is unterminated', () => {
      // Arrange
      const xml = '<a x="1>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toEqual({ kind: 'unterminated' })
    })
  })

  describe('given an empty element name', () => {
    it('when lexOpenTag then the name is an empty string', () => {
      // Arrange
      const xml = '<>x'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: '', end: 2 })
    })
  })

  describe('given a name that runs to EOF with no `>`', () => {
    it('when lexOpenTag then it is unterminated', () => {
      // Arrange
      const xml = '<abc'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toEqual({ kind: 'unterminated' })
    })
  })

  describe('given a quote inside the element name', () => {
    it('when lexOpenTag then strayQuote is true', () => {
      // Arrange
      const xml = '<a"b>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ name: 'a"b', strayQuote: true })
    })
  })

  describe('given a quote inside an attribute name', () => {
    it('when lexOpenTag then strayQuote is true', () => {
      // Arrange
      const xml = '<a b"c="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { 'b"c': '1' }, strayQuote: true })
    })
  })

  describe('given a quote inside an unquoted attribute value', () => {
    it('when lexOpenTag then strayQuote is true', () => {
      // Arrange
      const xml = '<a b=1"2>'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { b: '1"2' }, strayQuote: true })
    })
  })

  describe('given a quote at a skipped position in the tag', () => {
    it('when lexOpenTag then strayQuote is true', () => {
      // Arrange
      const xml = '<a "  b="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ attrs: { b: '1' }, strayQuote: true })
    })
  })

  describe('given no stray quote anywhere in the tag', () => {
    it('when lexOpenTag then strayQuote is false', () => {
      // Arrange
      const xml = '<a x="1">'

      // Act
      const sut = lexOpenTag(xml, 0)

      // Assert
      expect(sut).toMatchObject({ strayQuote: false })
    })
  })
})
