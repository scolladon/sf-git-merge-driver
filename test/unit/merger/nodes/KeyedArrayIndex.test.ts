import { describe, expect, it } from 'vitest'
import {
  extractKeys,
  toSideKeys,
} from '../../../../src/merger/nodes/KeyedArrayIndex.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'

describe('KeyedArrayIndex', () => {
  describe('toSideKeys', () => {
    const keyOf = (item: JsonObject) => item['k'] as string | undefined

    interface Row {
      readonly name: string
      readonly side: JsonArray
      readonly expected: readonly string[] | undefined
    }

    it.each<Row>([
      { name: 'no entry', side: [], expected: [] },
      {
        name: 'keyed entries',
        side: [{ k: 'a' }, { k: 'b' }],
        expected: ['a', 'b'],
      },
      { name: 'an empty key', side: [{ k: '' }], expected: [''] },
      {
        name: 'a real key spelled "undefined"',
        side: [{ k: 'undefined' }],
        expected: ['undefined'],
      },
      { name: 'one keyless entry', side: [{ v: '1' }], expected: undefined },
      {
        name: 'a keyless entry among keyed ones',
        side: [{ k: 'a' }, { v: '1' }],
        expected: undefined,
      },
      { name: 'a non-object entry', side: ['x'], expected: undefined },
    ])(
      'given $name when reading side keys then returns $expected',
      ({ side, expected }) => {
        // Arrange
        const sut = toSideKeys
        const extracted = extractKeys(side, keyOf)

        // Act
        const result = sut(extracted)

        // Assert
        expect(result).toEqual(expected)
      }
    )
  })
})
