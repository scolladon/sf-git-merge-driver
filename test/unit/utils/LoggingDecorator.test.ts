'use strict'

import {
  hasCustomToString,
  stringify,
} from '../../../src/utils/LoggingDecorator.js'

describe('LoggingDecorator', () => {
  describe('hasCustomToString', () => {
    // Objects with custom toString
    it('given object with custom toString when hasCustomToString then returns true', () => {
      // Arrange
      const obj = {
        toString: () => 'custom',
      }

      // Act
      const result = hasCustomToString(obj)

      // Assert
      expect(result).toBe(true)
    })

    it('given class instance with custom toString when hasCustomToString then returns true', () => {
      // Arrange
      class CustomClass {
        toString() {
          return 'custom'
        }
      }
      const sut = new CustomClass()

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    // Objects without custom toString
    it('given plain object when hasCustomToString then returns false', () => {
      // Arrange
      const sut = {}

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given class instance without custom toString when hasCustomToString then returns false', () => {
      // Arrange
      class PlainClass {}
      const sut = new PlainClass()

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    // Edge cases
    it('given null when hasCustomToString then returns false', () => {
      // Arrange
      const sut = null

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given undefined when hasCustomToString then returns false', () => {
      // Arrange
      const sut = undefined

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given primitives when hasCustomToString then returns false', () => {
      // Arrange
      const numberSut = 42
      const stringSut = 'string'
      const booleanSut = true
      const symbolSut = Symbol()

      // Act & Assert
      expect(hasCustomToString(numberSut)).toBe(false)
      expect(hasCustomToString(stringSut)).toBe(false)
      expect(hasCustomToString(booleanSut)).toBe(false)
      expect(hasCustomToString(symbolSut)).toBe(false)
    })

    // Special cases
    it('given object with own toString property when hasCustomToString then returns true', () => {
      // Arrange
      const sut = Object.create(null)
      sut.toString = () => 'custom'

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given object with non-function toString when hasCustomToString then returns false', () => {
      // Arrange
      const sut = { toString: 'not a function' }

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given Date object when hasCustomToString then returns true', () => {
      // Arrange
      const sut = new Date()

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given Array object when hasCustomToString then returns true', () => {
      // Arrange
      const sut = []

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given object with prototype chain toString when hasCustomToString then returns true', () => {
      // Arrange
      const parent = { toString: () => 'parent' }
      const sut = Object.create(parent)

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    // Additional test cases
    it('given Error object when hasCustomToString then returns true', () => {
      // Arrange
      const sut = new Error('test')

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given object with Symbol.toStringTag when hasCustomToString then returns true', () => {
      // Arrange
      const sut = {
        [Symbol.toStringTag]: 'Test',
        toString: () => 'custom',
      }

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given Proxy object when hasCustomToString then returns true', () => {
      // Arrange
      const target = { toString: () => 'proxy target' }
      const sut = new Proxy(target, {})

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given object with only Symbol.toStringTag when hasCustomToString then returns false', () => {
      // Arrange
      const sut = { [Symbol.toStringTag]: 'Test' }

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    // Prototype-less object tests
    it('given prototype-less object without toString when hasCustomToString then returns false', () => {
      // Arrange
      const sut = Object.create(null)

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given prototype-less object with added toString when hasCustomToString then returns true', () => {
      // Arrange
      const sut = Object.create(null)
      sut.toString = () => 'custom'

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given prototype-less object with non-function toString when hasCustomToString then returns false', () => {
      // Arrange
      const sut = Object.create(null)
      sut.toString = 'not a function'

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })

    it('given prototype-less object with inherited toString when hasCustomToString then returns true', () => {
      // Arrange
      const parent = Object.create(null)
      parent.toString = () => 'parent'
      const sut = Object.create(parent)

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(true)
    })

    it('given object with null prototype and no toString when hasCustomToString then returns false', () => {
      // Arrange
      const sut = Object.create(null)

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
      expect(Object.getPrototypeOf(sut)).toBeNull()
    })

    it('given object with null prototype chain when hasCustomToString then returns false', () => {
      // Arrange
      const sut = Object.create(null)

      // Act
      const result = hasCustomToString(sut)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('stringify', () => {
    it('given Map when stringify then converts to array of entries', () => {
      // Arrange
      const sut = new Map()
      sut.set('key1', 'value1')
      sut.set('key2', 'value2')

      // Act
      const result = stringify(sut)

      // Assert
      const parsed = JSON.parse(result)
      expect(parsed).toEqual([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ])
    })

    it('given Set when stringify then converts to array', () => {
      // Arrange
      const sut = new Set(['value1', 'value2', 'value3'])

      // Act
      const result = stringify(sut)

      // Assert
      const parsed = JSON.parse(result)
      expect(parsed).toEqual(['value1', 'value2', 'value3'])
    })

    it('given nested Map and Set structures when stringify then handles correctly', () => {
      // Arrange
      const sut = new Map()
      const innerSet = new Set(['a', 'b', 'c'])
      sut.set('set', innerSet)
      sut.set('primitive', 42)

      // Act
      const result = stringify(sut)

      // Assert
      const parsed = JSON.parse(result)
      expect(parsed).toEqual([
        ['set', ['a', 'b', 'c']],
        ['primitive', 42],
      ])
    })

    it('given Map with complex key types when stringify then handles correctly', () => {
      // Arrange
      const sut = new Map()
      sut.set({ id: 1 }, 'object key')
      sut.set(42, 'number key')

      // Act
      const result = stringify(sut)

      // Assert
      const parsed = JSON.parse(result)
      expect(parsed.length).toBe(2)
      expect(parsed[1]).toEqual([42, 'number key'])
    })

    it('given empty Map and Set when stringify then returns empty array', () => {
      // Arrange
      const emptySutMap = new Map()
      const emptySutSet = new Set()

      // Act & Assert
      expect(stringify(emptySutMap)).toBe('[]')
      expect(stringify(emptySutSet)).toBe('[]')
    })
  })
})
