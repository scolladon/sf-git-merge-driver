import { describe, expect, it } from 'vitest'
import { buildConflictMarkers } from '../../../../src/merger/ConflictMarkerBuilder.js'
import { mergeElementPresence } from '../../../../src/merger/nodes/elementPresence.js'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'

const ATTRIBUTE = 'nameField'
const element = { label: 'x', type: 'Text' }
const edited = { label: 'y', type: 'Text' }

describe('mergeElementPresence', () => {
  describe('given an element every side carries', () => {
    describe('when merging', () => {
      it('then the content decides', () => {
        // Arrange
        const sides = { ancestor: element, local: edited, other: element }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toBeNull()
      })
    })
  })

  describe('given an element both live sides carry', () => {
    describe('when the ancestor lacks it', () => {
      it('then the content decides', () => {
        // Arrange
        const sides = { ancestor: undefined, local: element, other: edited }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toBeNull()
      })
    })
  })

  describe('given no side carrying the element', () => {
    describe('when merging', () => {
      it('then nothing is output', () => {
        // Arrange
        const sides = {
          ancestor: undefined,
          local: undefined,
          other: undefined,
        }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given only the ancestor carrying the element', () => {
    describe('when both live sides deleted it', () => {
      it('then it stays deleted', () => {
        // Arrange
        const sides = { ancestor: element, local: undefined, other: undefined }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given only local carrying the element', () => {
    describe('when merging', () => {
      it('then the whole element is taken verbatim', () => {
        // Arrange
        const sides = { ancestor: undefined, local: element, other: undefined }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [{ [ATTRIBUTE]: element }],
          hasConflict: false,
        })
      })
    })
  })

  describe('given only other carrying the element', () => {
    describe('when merging', () => {
      it('then the whole element is taken verbatim', () => {
        // Arrange
        const sides = { ancestor: undefined, local: undefined, other: element }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [{ [ATTRIBUTE]: element }],
          hasConflict: false,
        })
      })
    })
  })

  describe('given other deleted the element', () => {
    describe('when local re-ordered its keys', () => {
      it('then one element block conflicts, a reorder being a change', () => {
        // Arrange
        const reordered = { type: 'Text', label: 'x' }
        const sides = { ancestor: element, local: reordered, other: undefined }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [
            buildConflictMarkers(
              [{ [ATTRIBUTE]: reordered }],
              [{ [ATTRIBUTE]: element }],
              []
            ),
          ],
          hasConflict: true,
        })
      })
    })

    describe('when local changed it', () => {
      it('then one element block conflicts', () => {
        // Arrange
        const sides = { ancestor: element, local: edited, other: undefined }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [
            buildConflictMarkers(
              [{ [ATTRIBUTE]: edited }],
              [{ [ATTRIBUTE]: element }],
              []
            ),
          ],
          hasConflict: true,
        })
      })
    })
  })

  describe('given local deleted the element', () => {
    describe('when other re-ordered its keys', () => {
      it('then one element block conflicts, a reorder being a change', () => {
        // Arrange
        const reordered = { type: 'Text', label: 'x' }
        const sides = { ancestor: element, local: undefined, other: reordered }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [
            buildConflictMarkers(
              [],
              [{ [ATTRIBUTE]: element }],
              [{ [ATTRIBUTE]: reordered }]
            ),
          ],
          hasConflict: true,
        })
      })
    })

    describe('when other changed it', () => {
      it('then one element block conflicts', () => {
        // Arrange
        const sides = { ancestor: element, local: undefined, other: edited }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({
          output: [
            buildConflictMarkers(
              [],
              [{ [ATTRIBUTE]: element }],
              [{ [ATTRIBUTE]: edited }]
            ),
          ],
          hasConflict: true,
        })
      })
    })
  })

  describe('given a side holding an empty value', () => {
    const nullPrototype = Object.create(null) as JsonObject
    const emptyValues: [string, JsonValue][] = [
      ['null', null],
      ['an empty string', ''],
      ['an empty object', {}],
      ['an empty list', []],
      ['an empty null-prototype object', nullPrototype],
    ]

    describe.each(emptyValues)('when local is %s', (_title, empty) => {
      it('then the element counts as deleted', () => {
        // Arrange
        const sides = { ancestor: element, local: empty, other: element }

        // Act
        const sut = mergeElementPresence(sides, ATTRIBUTE)

        // Assert
        expect(sut).toEqual({ output: [], hasConflict: false })
      })
    })
  })

  describe('given an element whose unordered nested entries were reordered on the surviving side', () => {
    const alert = (types: string[]) => ({
      fullName: 'X',
      recipients: types.map(type => ({ type })),
    })

    describe('when the other side deleted the element', () => {
      it('then the deletion is taken without conflict', () => {
        // Arrange
        const ancestor = alert(['user', 'role'])
        const reordered = alert(['role', 'user'])
        const sides = [
          { ancestor, local: reordered, other: undefined },
          { ancestor, local: undefined, other: reordered },
        ]

        // Act
        const sut = sides.map(side => mergeElementPresence(side, 'alerts'))

        // Assert
        expect(sut).toEqual([
          { output: [], hasConflict: false },
          { output: [], hasConflict: false },
        ])
      })
    })
  })
})
