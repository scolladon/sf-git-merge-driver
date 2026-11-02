import { describe, expect, it } from 'vitest'
import {
  ABSENT_POSITION,
  isOn,
  LIVE_SIDES,
  type OrderedEntry,
  otherSideOf,
  positionOn,
  valueOn,
  writtenOn,
} from '../../../../../src/merger/nodes/ordered/orderedEntry.js'

const LOCAL_VALUE = { name: 'local' }
const OTHER_VALUE = { name: 'other' }

const localOnly: OrderedEntry = {
  id: 0,
  key: 'k',
  local: LOCAL_VALUE,
  ancestorPos: ABSENT_POSITION,
  localPos: 3,
  otherPos: ABSENT_POSITION,
}
const otherOnly: OrderedEntry = {
  id: 1,
  key: 'k',
  other: OTHER_VALUE,
  ancestorPos: ABSENT_POSITION,
  localPos: ABSENT_POSITION,
  otherPos: 5,
}

describe('positionOn', () => {
  describe.each([
    ['local', localOnly, 3],
    ['other', otherOnly, 5],
  ] as const)('given the %s side', (side, entry, expected) => {
    it('then it is that side position', () => {
      // Arrange
      const sut = positionOn

      // Act
      const result = sut(entry, side)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

describe('valueOn', () => {
  describe.each([
    ['local', localOnly, LOCAL_VALUE],
    ['other', otherOnly, OTHER_VALUE],
    ['other', localOnly, undefined],
    ['local', otherOnly, undefined],
  ] as const)('given the %s side', (side, entry, expected) => {
    it('then it is that side value', () => {
      // Arrange
      const sut = valueOn

      // Act
      const result = sut(entry, side)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

describe('isOn', () => {
  describe.each([
    ['local', localOnly, true],
    ['other', localOnly, false],
    ['other', otherOnly, true],
    ['local', otherOnly, false],
  ] as const)('given the %s side', (side, entry, expected) => {
    it('then it tells whether the entry is there', () => {
      // Arrange
      const sut = isOn

      // Act
      const result = sut(entry, side)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

describe('otherSideOf', () => {
  describe.each([
    ['local', 'other'],
    ['other', 'local'],
  ] as const)('given the %s side', (side, expected) => {
    it('then it is the opposite live side', () => {
      // Arrange
      const sut = otherSideOf

      // Act
      const result = sut(side)

      // Assert
      expect(result).toBe(expected)
    })
  })
})

describe('LIVE_SIDES', () => {
  describe('given the two sides a merge reads', () => {
    it('then every side is the opposite of its opposite', () => {
      // Arrange
      const sut = LIVE_SIDES

      // Act
      const result = sut.map(side => otherSideOf(otherSideOf(side)))

      // Assert
      expect(result).toEqual(['local', 'other'])
    })
  })
})

describe('writtenOn', () => {
  describe('given entries listed out of the order a side wrote them', () => {
    describe('when reading one side', () => {
      it('then the entries the side holds come in its written order', () => {
        // Arrange
        const first = { ...otherOnly, id: 2, otherPos: 0 }
        const sut = writtenOn

        // Act
        const result = sut([otherOnly, localOnly, first], 'other')

        // Assert
        expect(result).toEqual([first, otherOnly])
      })
    })
  })

  describe('given no entry on the side', () => {
    describe('when reading it', () => {
      it('then it is empty', () => {
        // Arrange
        const sut = writtenOn

        // Act
        const result = sut([otherOnly], 'local')

        // Assert
        expect(result).toEqual([])
      })
    })
  })
})
