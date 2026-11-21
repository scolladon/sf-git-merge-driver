import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { WriteOptions } from '../../../../src/adapter/XmlSerializer.js'
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '../../../../src/types/jsonTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'
const MISSING_SIDES_MESSAGE =
  "Cannot read properties of undefined (reading 'every')"

const FLAG_OPTIONS: readonly WriteOptions[] = [
  { hasConflict: false },
  { hasConflict: true },
]
// The second line of `a` reads as a marker: under the conflict flag the root
// slot's attributes are escaped like any value
const OPENING_ROOT_ATTRIBUTES: JsonObject = {
  '@_xmlns': 'u',
  '@_a': 'x\n=======',
}

const sut = new XmlStreamWriter(defaultConfig)

const conflictOf = (
  local: JsonArray,
  ancestor: JsonArray,
  other: JsonArray
): JsonValue => ({ __conflict: true as const, local, ancestor, other })

const block = conflictOf([{ c: 'L' }], [], [{ c: 'O' }])

const documentOf = (text: string): string => `${DECL}\n${text}\n`

const onBothFlags = (
  rows: ReadonlyArray<readonly [JsonObject, string]>
): Array<[JsonObject, boolean, string]> =>
  rows.flatMap(([tree, expected]) => [
    [tree, false, expected],
    [tree, true, expected],
  ])

const expectLiteral = async (
  writer: XmlStreamWriter,
  tree: JsonObject,
  options: WriteOptions,
  expected: string
): Promise<void> => {
  const result = await serializeToString(writer, [tree], {}, options)
  expect(result).toBe(expected)
}

describe('XmlStreamWriter', () => {
  describe('given a body both flags write alike', () => {
    it.each(
      onBothFlags([
        [
          { a: { b: 'x', c: ['1', '2'] } },
          '<a>\n    <b>x</b>\n    <c>1</c>\n    <c>2</c>\n</a>',
        ],
        [{ a: { b: [] } }, '<a/>'],
        [{ a: { b: [], c: 'x' } }, '<a>\n    <c>x</c>\n</a>'],
        [{ a: { '#text': '' } }, '<a/>'],
        [{ a: { '#text': 't', b: 'x' } }, '<a>t\n    <b>x</b>\n</a>'],
        [{ a: { '@_x': '1', b: 'x' } }, '<a x="1">\n    <b>x</b>\n</a>'],
        [
          { a: { '@_x': '1', b: ['1', '2'] } },
          '<a x="1">\n    <b>1</b>\n    <b>2</b>\n</a>',
        ],
        [{ a: { __cdata: ['x', 'y'] } }, '<a><![CDATA[x]]><![CDATA[y]]>\n</a>'],
        [
          { a: { '#xml__comment': ['c', 'd'], b: 'x' } },
          '<a><!--c--><!--d-->\n    <b>x</b>\n</a>',
        ],
        [{ a: { _x: 'y', b: 'x' } }, '<a>\n    <_x>y</_x>\n    <b>x</b>\n</a>'],
        [{ a: { '': 'x' } }, '<a>\n    <>x</>\n</a>'],
        [{ a: 'x' }, '<a>x</a>'],
        [{ a: '' }, '<a/>'],
        [{ a: 7 }, '<a>7</a>'],
        [{ a: true }, '<a>true</a>'],
        [{ a: null }, '<a/>'],
        [{ a: { b: 'l1\nl2' } }, '<a>\n    <b>l1\nl2</b>\n</a>'],
        [{ a: { 'b\nc': 'x' } }, '<a>\n    <b\nc>x</b\nc>\n</a>'],
        // An indented line starting with the word `undefined` is no marker
        // line
        [
          { Root: [{ b: 'x' }, 'undefined'] },
          '<Root>\n    <b>x</b>\n    undefined</Root>',
        ],
      ])
    )(
      'when %j is written with conflict flag %s then it reads as the expected document',
      async (tree, hasConflict, expected) => {
        // Act & Assert
        await expectLiteral(sut, tree, { hasConflict }, documentOf(expected))
      }
    )
  })

  describe('given a body the conflict flag changes', () => {
    it.each([
      [
        { a: { b: block, c: 'x' } },
        false,
        documentOf(
          '<a>\n<<<<<<< ours\n    <c>L</c>\n    ||||||| base\n=======\n    <c>O</c>\n    >>>>>>> theirs\n    <c>x</c>\n</a>'
        ),
      ],
      [
        { a: { b: block, c: 'x' } },
        true,
        documentOf(
          '<a>\n<<<<<<< ours\n    <c>L</c>\n||||||| base\n=======\n    <c>O</c>\n>>>>>>> theirs\n    <c>x</c>\n</a>'
        ),
      ],
      [
        { a: block },
        false,
        `${DECL}\n\n<<<<<<< ours\n<c>L</c>\n||||||| base\n=======\n<c>O</c>\n>>>>>>> theirs\n`,
      ],
      [
        { a: block },
        true,
        `${DECL}\n<<<<<<< ours\n<c>L</c>\n||||||| base\n=======\n<c>O</c>\n>>>>>>> theirs\n`,
      ],
      [
        { a: { b: 'l1\n<<<<<<< x' } },
        false,
        documentOf('<a>\n    <b>l1\n<<<<<<< x</b>\n</a>'),
      ],
      [
        { a: { b: 'l1\n<<<<<<< x' } },
        true,
        documentOf('<a>\n    <b>l1\n&#60;<<<<<< x</b>\n</a>'),
      ],
      [
        { a: { 'b\n \nc': 'x' } },
        false,
        documentOf('<a>\n    <b\n \nc>x</b\n \nc>\n</a>'),
      ],
      [
        { a: { 'b\n \nc': 'x' } },
        true,
        documentOf('<a>\n    <b\n \nc>x</b\nc>\n</a>'),
      ],
      [
        { a: { 'b\n\t<<<<<<< q': 'x' } },
        false,
        documentOf('<a>\n    <b\n\t<<<<<<< q>x</b\n\t<<<<<<< q>\n</a>'),
      ],
      [
        { a: { 'b\n\t<<<<<<< q': 'x' } },
        true,
        documentOf('<a>\n    <b\n<<<<<<< q>x</b\n<<<<<<< q>\n</a>'),
      ],
      [
        { a: { b: 'v1\n   \nv2', d: block } },
        true,
        documentOf(
          '<a>\n    <b>v1\n   \nv2</b>\n<<<<<<< ours\n    <c>L</c>\n||||||| base\n=======\n    <c>O</c>\n>>>>>>> theirs\n</a>'
        ),
      ],
      // After a sibling's `>`, a body opening on a conflict block still puts
      // its first marker right under the opening tag
      [
        { Root: { x: 'y', a: { b: block } } },
        false,
        documentOf(
          '<Root>\n    <x>y</x>\n    <a>\n<<<<<<< ours\n        <c>L</c>\n        ||||||| base\n=======\n        <c>O</c>\n        >>>>>>> theirs\n    </a>\n</Root>'
        ),
      ],
      [
        { Root: { x: 'y', a: { b: block } } },
        true,
        documentOf(
          '<Root>\n    <x>y</x>\n    <a>\n<<<<<<< ours\n        <c>L</c>\n||||||| base\n=======\n        <c>O</c>\n>>>>>>> theirs\n    </a>\n</Root>'
        ),
      ],
    ])(
      'when %j is written with conflict flag %s then it reads as the expected document',
      async (tree, hasConflict, expected) => {
        // Act & Assert
        await expectLiteral(sut, tree, { hasConflict }, expected)
      }
    )
  })

  // A blank and a word after the carriage return would match an expression
  // not anchored to the line start, which would cut the line down to the word
  describe('given an ancestor tag holding a carriage return', () => {
    it.each([
      [
        'base\r',
        '<a>\n<<<<<<< ours\n    <c>L</c>\n    ||||||| base\r\n=======\n    <c>O</c>\n>>>>>>> theirs\n</a>',
      ],
      [
        'base\r x',
        '<a>\n<<<<<<< ours\n    <c>L</c>\n    ||||||| base\r x\n=======\n    <c>O</c>\n>>>>>>> theirs\n</a>',
      ],
    ])(
      'when a conflict is written with tag %j then the indent before its marker stays',
      async (ancestorConflictTag, written) => {
        // Arrange
        const writer = new XmlStreamWriter({
          ...defaultConfig,
          ancestorConflictTag,
        })
        const expected = documentOf(written)

        // Act & Assert
        await expectLiteral(
          writer,
          { a: { b: block } },
          { hasConflict: true },
          expected
        )
      }
    )
  })

  describe('given a root attribute whose second line reads as a marker', () => {
    it('when written with the conflict flag then that line is escaped', async () => {
      // Arrange
      const ordered = [{ Root: { b: 'x' } }]
      const options: WriteOptions = { hasConflict: true }
      const expected = documentOf(
        '<Root xmlns="u" a="x\n&#61;======">\n    <b>x</b>\n</Root>'
      )

      // Act
      const result = await serializeToString(
        sut,
        ordered,
        OPENING_ROOT_ATTRIBUTES,
        options
      )

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('given a conflict flag present without its sides', () => {
    it.each(FLAG_OPTIONS)(
      'when written with %j then it throws a TypeError',
      async options => {
        // Arrange
        const ordered = [{ a: { __conflict: true } }]

        // Act
        const result = serializeToString(sut, ordered, {}, options)

        // Assert
        await expect(result).rejects.toBeInstanceOf(TypeError)
        await expect(result).rejects.toThrow(MISSING_SIDES_MESSAGE)
      }
    )
  })
})
