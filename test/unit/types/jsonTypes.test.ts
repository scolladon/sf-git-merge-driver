import { describe, expect, it } from 'vitest'
import {
  getJsonProp,
  type JsonArray,
  type JsonObject,
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
