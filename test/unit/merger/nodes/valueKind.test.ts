import { describe, expect, it } from 'vitest'
import {
  holdsOneValue,
  ValueKind,
  valueKindOf,
} from '../../../../src/merger/nodes/valueKind.js'
import type { JsonValue } from '../../../../src/types/jsonTypes.js'

const ELEMENT = { child: 'v' }
const CDATA = { __cdata: 'x' }
const COMMENT = { '#xml__comment': 'c' }
const PARTS_CDATA = { __cdata: ['A', 'B'] }
const PARTS_COMMENTS = { '#xml__comment': ['c1', 'c2'] }

describe('valueKindOf', () => {
  describe.each([
    ['undefined', undefined, ValueKind.ABSENT],
    ['null', null, ValueKind.ABSENT],
    ['an empty string', '', ValueKind.EMPTY],
    ['a string', 'a', ValueKind.TEXT],
    ['a number', 1, ValueKind.TEXT],
    ['a boolean', false, ValueKind.TEXT],
    ['a CDATA section', CDATA, ValueKind.CDATA_ONLY],
    ['a comment', COMMENT, ValueKind.COMMENT_ONLY],
    ['both', { ...CDATA, ...COMMENT }, ValueKind.CONTENT_ONLY],
    ['adjacent CDATA sections', { __cdata: ['A', 'B'] }, ValueKind.PARTS],
    ['adjacent comments', { '#xml__comment': ['c1', 'c2'] }, ValueKind.PARTS],
    ['a child element', ELEMENT, ValueKind.ELEMENT],
    ['a CDATA section beside a child', { ...CDATA, b: '1' }, ValueKind.ELEMENT],
    ['an attribute', { '@_a': '1' }, ValueKind.ELEMENT],
    ['an empty object', {}, ValueKind.ELEMENT],
    ['an array', [ELEMENT], ValueKind.REPEATED],
  ])('given %s', (_, side, expected) => {
    it('when asked then it is that kind', () => {
      // Act
      const sut = valueKindOf(side as JsonValue | undefined)

      // Assert
      expect(sut).toBe(expected)
    })
  })
})

describe('holdsOneValue', () => {
  const MIXED = { child: 'v', '#text': 'a' }
  const TEXT_AND_CDATA = { '#text': 'a', ...CDATA }
  const TEXT_AND_COMMENT = { '#text': 'a', ...COMMENT }
  const TEXT_AND_CONTENT = { '#text': 'a', ...CDATA, ...COMMENT }

  describe.each([
    ['text beside a child', [MIXED, MIXED, MIXED]],
    ['text and CDATA', [TEXT_AND_CDATA, TEXT_AND_CDATA, TEXT_AND_CDATA]],
    ['text and a comment', [TEXT_AND_COMMENT, TEXT_AND_COMMENT, 'a']],
    ['text, CDATA and a comment', [TEXT_AND_CONTENT, undefined, 'a']],
    ['CDATA and a comment', [{ ...CDATA, ...COMMENT }, CDATA, CDATA]],
    ['adjacent CDATA sections', [PARTS_CDATA, PARTS_CDATA, PARTS_CDATA]],
    ['adjacent comments', [COMMENT, PARTS_COMMENTS, COMMENT]],
    [
      'adjacent CDATA sections on the ancestor only',
      [PARTS_CDATA, undefined, undefined],
    ],
    [
      'adjacent CDATA sections on the local side only',
      [undefined, PARTS_CDATA, undefined],
    ],
    [
      'adjacent CDATA sections on the other side only',
      [undefined, undefined, PARTS_CDATA],
    ],
    ['text and an element', ['x', ELEMENT, ELEMENT]],
    ['an empty element and an element', [ELEMENT, '', ELEMENT]],
    ['text and an empty element', ['x', '', 'x']],
    ['a number and an element', [ELEMENT, ELEMENT, 1]],
    ['text, an element and an absent side', [undefined, 'x', ELEMENT]],
    ['CDATA and an element', [CDATA, ELEMENT, { __cdata: 'y' }]],
    ['a comment and text', ['a', COMMENT, 'c']],
    ['a comment and an empty element', [COMMENT, '', '']],
    ['a comment and CDATA', [COMMENT, COMMENT, CDATA]],
  ])('given %s', (_, [ancestor, local, other]) => {
    it('when asked then it is one value', () => {
      // Act
      const sut = holdsOneValue(
        ancestor as JsonValue,
        local as JsonValue,
        other as JsonValue
      )

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe.each([
    ['text only', ['x', 'y', 1]],
    ['a CDATA section only', [CDATA, { __cdata: 'y' }, CDATA]],
    ['a comment only', [COMMENT, COMMENT, COMMENT]],
    ['elements only', [ELEMENT, ELEMENT, ELEMENT]],
    ['an element and absent sides', [ELEMENT, undefined, null]],
    ['absent sides only', [undefined, null, undefined]],
    ['a multi-part text and a repeated element', [MIXED, [ELEMENT], MIXED]],
    [
      'a repeated element and an element',
      [[ELEMENT, ELEMENT], ELEMENT, ELEMENT],
    ],
    ['a repeated element, an element and text', [[ELEMENT], ELEMENT, 'x']],
  ])('given %s', (_, [ancestor, local, other]) => {
    it('when asked then the sides are not one value', () => {
      // Act
      const sut = holdsOneValue(
        ancestor as JsonValue,
        local as JsonValue,
        other as JsonValue
      )

      // Assert
      expect(sut).toBe(false)
    })
  })
})
