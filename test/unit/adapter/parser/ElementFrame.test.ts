import { describe, expect, it } from 'vitest'
import {
  ElementFrame,
  NO_ATTRS,
} from '../../../../src/adapter/parser/ElementFrame.js'

describe('ElementFrame', () => {
  describe('given an element with no attrs and no children', () => {
    it('when toCompact then it returns an empty string leaf', () => {
      // Arrange
      const sut = new ElementFrame('v', NO_ATTRS)

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toBe('')
    })
  })

  describe('given a leaf element with only text', () => {
    it('when toCompact then it returns the text as a scalar', () => {
      // Arrange
      const sut = new ElementFrame('v', NO_ATTRS)
      sut.addText('1')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toBe('1')
    })
  })

  describe('given an attrs-only element with no body', () => {
    it('when toCompact then attrs land under @_ with an explicit empty #text', () => {
      // Arrange
      const sut = new ElementFrame('v', { attrs: { x: '1' }, hasAttrs: true })

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toEqual({ '@_x': '1', '#text': '' })
    })

    it('when toCompact then the result carries no prototype chain', () => {
      // Arrange
      const sut = new ElementFrame('v', { attrs: { x: '1' }, hasAttrs: true })

      // Act
      const result = sut.toCompact()

      // Assert
      expect(Object.getPrototypeOf(result)).toBeNull()
    })
  })

  describe('given repeated same-key children', () => {
    it('when toCompact then they collapse into an array in first-seen order', () => {
      // Arrange
      const sut = new ElementFrame('r', NO_ATTRS)
      sut.addChild('v', '1')
      sut.addChild('v', '2')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toEqual({ v: ['1', '2'] })
    })
  })

  describe('given a __proto__-named child (prototype-pollution guard)', () => {
    it('when toCompact then it round-trips as an ordinary own property', () => {
      // Arrange
      const sut = new ElementFrame('r', NO_ATTRS)
      sut.addChild('__proto__', 'x')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(Object.keys(result as object)).toContain('__proto__')
      expect((result as Record<string, unknown>)['__proto__']).toBe('x')
    })

    it('when toCompact then the result carries no prototype chain', () => {
      // Arrange
      const sut = new ElementFrame('r', NO_ATTRS)
      sut.addChild('__proto__', 'x')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(Object.getPrototypeOf(result)).toBeNull()
    })
  })

  describe('given mixed text and element children', () => {
    it('when toCompact then children precede #text, in first-seen order', () => {
      // Arrange
      const sut = new ElementFrame('r', NO_ATTRS)
      sut.addChild('v', '1')
      sut.addText('foo')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(Object.keys(result as object)).toEqual(['v', '#text'])
      expect(result).toEqual({ v: '1', '#text': 'foo' })
    })
  })

  describe('given a comment child added via addChild', () => {
    it('when toCompact then it groups under the given key like any other child', () => {
      // Arrange
      const sut = new ElementFrame('r', NO_ATTRS)
      sut.addChild('#xml__comment', 'c')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toEqual({ '#xml__comment': 'c' })
    })
  })

  describe('given a CDATA child added via addChild', () => {
    it('when toCompact then it groups under the given key like any other child', () => {
      // Arrange
      const sut = new ElementFrame('v', NO_ATTRS)
      sut.addChild('__cdata', 'raw')

      // Act
      const result = sut.toCompact()

      // Assert
      expect(result).toEqual({ __cdata: 'raw' })
    })
  })
})
