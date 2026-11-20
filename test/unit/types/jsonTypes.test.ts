import { describe, expect, it } from 'vitest'
import {
  getJsonProp,
  type JsonArray,
  type JsonObject,
  toJsonObjectOrEmpty,
} from '../../../src/types/jsonTypes.js'

describe('jsonTypes.getJsonProp', () => {
  it('Given a JsonObject, When accessing a present key, Then returns the value', () => {
    // Arrange
    const sut: JsonObject = { name: 'Alice', age: 30 }

    // Act + Assert
    expect(getJsonProp(sut, 'name')).toBe('Alice')
    expect(getJsonProp(sut, 'age')).toBe(30)
  })

  it('Given a JsonObject, When accessing a missing key, Then returns undefined', () => {
    // Arrange
    const sut: JsonObject = { name: 'Alice' }

    // Act + Assert
    expect(getJsonProp(sut, 'absent')).toBeUndefined()
  })

  it('Given a JsonArray, When accessing any string key, Then returns undefined (array has no string index)', () => {
    // Arrange
    const sut: JsonArray = ['a', 'b', 'c']

    // Act + Assert
    expect(getJsonProp(sut, '0')).toBeUndefined()
    expect(getJsonProp(sut, 'length')).toBeUndefined()
    expect(getJsonProp(sut, 'anything')).toBeUndefined()
  })
})

describe('jsonTypes.toJsonObjectOrEmpty', () => {
  it('Given a JsonObject, When narrowing, Then returns the same reference', () => {
    const sut: JsonObject = { a: 1 }
    expect(toJsonObjectOrEmpty(sut)).toBe(sut)
  })

  it('Given a JsonArray, When narrowing, Then returns a fresh empty object (arrays have no string-keyed content to iterate)', () => {
    const sut: JsonArray = ['x', 'y']
    expect(toJsonObjectOrEmpty(sut)).toEqual({})
  })

  describe.each([
    ['a string', 'x'],
    ['an empty string', ''],
    ['a number', 1],
    ['a boolean', true],
    ['null', null],
    ['an absent side', undefined],
  ])('Given %s', (_, value) => {
    it('When narrowing, Then returns an empty object that reads no inherited property', () => {
      // Act
      const sut = toJsonObjectOrEmpty(value)

      // Assert
      expect(Object.keys(sut)).toEqual([])
      expect(sut['toString']).toBeUndefined()
      expect(sut['0']).toBeUndefined()
    })
  })

  it('Given a JsonArray, When narrowing, Then the stand-in inherits nothing', () => {
    const sut: JsonArray = ['x']
    const narrowed = toJsonObjectOrEmpty(sut)
    expect(Object.getPrototypeOf(narrowed)).toBeNull()
    expect(narrowed['constructor']).toBeUndefined()
  })
})
