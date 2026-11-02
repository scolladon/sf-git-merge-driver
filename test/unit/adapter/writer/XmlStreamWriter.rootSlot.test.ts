import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { RootAttributeSides } from '../../../../src/adapter/XmlSerializer.js'
import type { JsonArray, JsonValue } from '../../../../src/types/jsonTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const sut = new XmlStreamWriter(defaultConfig)

const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n'
const ROOT_ATTRIBUTES = { '@_xmlns': 'x' }

const namespaces = (
  local: string,
  ancestor: string,
  other: string
): RootAttributeSides => ({
  local: { '@_xmlns': local },
  ancestor: { '@_xmlns': ancestor },
  other: { '@_xmlns': other },
})

const SIDES = namespaces('l', 'a', 'o')

const conflictOf = (
  local: JsonArray,
  ancestor: JsonArray,
  other: JsonArray
): JsonValue => ({ __conflict: true as const, local, ancestor, other })

const CONTESTED_START_TAGS = (end: string): string =>
  `<<<<<<< ours\n<Root xmlns="l"${end}\n||||||| base\n<Root xmlns="a"${end}\n=======\n<Root xmlns="o"${end}\n>>>>>>> theirs\n`

describe('XmlStreamWriter root slot', () => {
  describe('given a document of several top-level tags', () => {
    it('when serialized then only the first one carries the root attributes', async () => {
      // Arrange
      const tree: JsonArray = [{ A: '1', B: '2' }]

      // Act
      const out = await serializeToString(sut, tree, ROOT_ATTRIBUTES)

      // Assert
      expect(out).toBe(`${DECLARATION}<A xmlns="x">1</A>\n<B>2</B>\n`)
    })
  })

  describe('given a conflict that occupies the whole document', () => {
    const wholeDocument = (
      local: string,
      ancestor: string,
      other: string
    ): JsonArray => [
      conflictOf(
        [{ Root: [{ a: local }] }],
        [{ Root: [{ a: ancestor }] }],
        [{ Root: [{ a: other }] }]
      ),
    ]

    it('when each side parsed its own root attributes then each side is written with them', async () => {
      // Arrange
      const tree = wholeDocument('1', '0', '2')

      // Act
      const out = await serializeToString(sut, tree, ROOT_ATTRIBUTES, {
        sides: SIDES,
      })

      // Assert
      expect(out).toContain('<Root xmlns="l">\n    <a>1</a>')
      expect(out).toContain('<Root xmlns="a">\n    <a>0</a>')
      expect(out).toContain('<Root xmlns="o">\n    <a>2</a>')
    })

    it('when the sides are unknown then every side is written with the merged root attributes', async () => {
      // Arrange
      const tree = wholeDocument('1', '0', '2')

      // Act
      const out = await serializeToString(sut, tree, ROOT_ATTRIBUTES)

      // Assert
      expect(out.match(/<Root xmlns="x">/g)).toHaveLength(3)
    })
  })

  describe('given contested root attributes', () => {
    it.each([
      ['no child', [], '/>', ''],
      ['a child', [{ a: '1' }], '>', '    <a>1</a>\n</Root>\n'],
      ['a text', [{ '#text': 'hi' }], '>', 'hi</Root>\n'],
      [
        'a text over several lines',
        [{ '#text': 'hi\nthere' }],
        '>',
        'hi\nthere</Root>\n',
      ],
    ])(
      'when the root holds %s then the start tags stand between the markers and the content follows',
      async (_, body, end, rest) => {
        // Arrange
        const tree: JsonArray = [{ Root: body }]

        // Act
        const out = await serializeToString(sut, tree, ROOT_ATTRIBUTES, {
          contested: SIDES,
        })

        // Assert
        expect(out).toBe(`${DECLARATION}${CONTESTED_START_TAGS(end)}${rest}`)
      }
    )
  })
})
