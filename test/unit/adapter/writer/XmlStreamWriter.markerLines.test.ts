import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { JsonArray, JsonValue } from '../../../../src/types/jsonTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const sut = new XmlStreamWriter(defaultConfig)

const conflictOf = (
  local: JsonArray,
  ancestor: JsonArray,
  other: JsonArray
): JsonValue => ({ __conflict: true as const, local, ancestor, other })

const inLocalSide = (content: JsonValue): JsonArray => [
  { Root: [conflictOf([{ v: content }], [], [])] },
]

// the ancestor, separator and other markers of the one conflict
const REAL_MARKER_LINES = 3

const lines = (out: string): string[] => out.split('\n')

describe('XmlStreamWriter marker-like lines inside a conflict side', () => {
  describe.each([
    ['=======', '&#61;======'],
    ['>>>>>>> theirs', '&#62;>>>>>> theirs'],
    ['||||||| base', '&#124;|||||| base'],
    ['  =======', '  &#61;======'],
    ['========', '&#61;======='],
  ])('given a text line %j', (line, escaped) => {
    it('when serialized then its first character is a character reference', async () => {
      // Arrange
      const tree = inLocalSide(`b\n${line}\nx`)

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(lines(out)).toContain(escaped)
      const markerLooking = lines(out).filter(l => /^[=>|]{7}/.test(l))
      expect(markerLooking).toHaveLength(REAL_MARKER_LINES)
    })
  })

  describe.each([
    ['six equal signs', '======'],
    ['a marker mid-line', 'a ======='],
    ['a less-than run, which text cannot hold', '&lt;&lt;&lt;&lt;&lt;&lt;&lt;'],
  ])('given %s', (_, line) => {
    it('when serialized then the line is untouched', async () => {
      // Arrange
      const tree = inLocalSide(`b\n${line}\nx`)

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(lines(out)).toContain(line)
    })
  })

  describe('given a marker-like text line outside any conflict', () => {
    it('when serialized then the text is byte-identical', async () => {
      // Arrange
      const tree: JsonArray = [{ Root: [{ v: 'b\n=======\nx' }] }]

      // Act
      const out = await serializeToString(sut, tree, {}, { hasConflict: false })

      // Assert
      expect(out).toContain('<v>b\n=======\nx</v>')
    })
  })

  describe('given a conflicted file whose unchanged text holds a marker-like line outside every side', () => {
    const outsideSides = (value: JsonValue): JsonArray => [
      { Root: [{ v: value }, conflictOf([{ w: 'x' }], [], [])] },
    ]

    it.each([
      ['=======', '&#61;======'],
      ['>>>>>>> theirs', '&#62;>>>>>> theirs'],
      ['||||||| base', '&#124;|||||| base'],
    ])('when serialized then the line %j is escaped', async (line, escaped) => {
      // Arrange
      const tree = outsideSides(`b\n${line}\nx`)

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(lines(out)).toContain(escaped)
      const markerLooking = lines(out).filter(l => /^[=>|]{7}/.test(l))
      expect(markerLooking).toHaveLength(REAL_MARKER_LINES)
    })

    it('when serialized then a marker-like line in an attribute value is escaped', async () => {
      // Arrange
      const tree = outsideSides({ '@_a': 'x\n=======\ny', '#text': 't' })

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toContain('<v a="x\n&#61;======\ny">')
    })
  })

  describe('given a marker-like line in an attribute value of a conflict side', () => {
    it('when serialized then its first character is a character reference', async () => {
      // Arrange
      const tree = inLocalSide({ '@_a': 'x\n=======\ny', '#text': 't' })

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toContain('<v a="x\n&#61;======\ny">')
    })
  })

  describe('given a configured marker size', () => {
    it('when serialized then lines of that size are the marker-like ones', async () => {
      // Arrange
      const small = new XmlStreamWriter({
        ...defaultConfig,
        conflictMarkerSize: 3,
      })
      const tree = inLocalSide('b\n===\n==\nx')

      // Act
      const out = await serializeToString(small, tree, {})

      // Assert
      expect(lines(out)).toContain('&#61;==')
      expect(lines(out)).toContain('==')
    })
  })

  describe.each([
    ['comment', { '#xml__comment': 'c\n=======\nd' }],
    ['CDATA', { __cdata: 'c\n>>>>>>> x\nd' }],
  ])('given a %s line that reads as a marker', (_, content) => {
    it('when serialized then the merge is refused', async () => {
      // Arrange
      const tree = inLocalSide(content as JsonValue)

      // Act
      const act = serializeToString(sut, tree, {})

      // Assert
      await expect(act).rejects.toThrow(
        'XML merge error: a comment or CDATA line in a file holding a conflict reads as a conflict marker'
      )
    })
  })

  describe.each([
    ['carriage return', '\r'],
    ['line separator', '\u2028'],
    ['paragraph separator', '\u2029'],
  ])(
    'given a marker-like text after a %s, which git does not split on',
    (_, separator) => {
      it.each([
        ['comment', { '#xml__comment': `c\nd${separator}=======` }],
        ['CDATA', { __cdata: `c\nd${separator}=======` }],
      ])(
        'when a %s is serialized then it is written as is',
        async (_kind, content) => {
          // Arrange
          const tree = inLocalSide(content as JsonValue)

          // Act
          const out = await serializeToString(sut, tree, {})

          // Assert
          expect(out).toContain(`d${separator}=======`)
        }
      )

      it('when a text is serialized then its characters are not escaped', async () => {
        // Arrange
        const tree = inLocalSide(`c${separator}=======`)

        // Act
        const out = await serializeToString(sut, tree, {})

        // Assert
        expect(out).toContain(`c${separator}=======`)
      })
    }
  )

  describe.each([
    ['comment', { '#xml__comment': '=======\nc' }],
    ['CDATA', { __cdata: '=======\nc' }],
    ['one-line comment', { '#xml__comment': ' a ======= ' }],
  ])(
    'given a %s whose marker-like text is on the opening line or mid-line',
    (_, content) => {
      it('when serialized then it is written', async () => {
        // Arrange
        const tree = inLocalSide(content as JsonValue)

        // Act
        const out = await serializeToString(sut, tree, {})

        // Assert
        expect(out).toContain('=======')
      })
    }
  )

  describe('given a comment with a marker-like line and a merge with no conflict', () => {
    it('when serialized then it is written as is', async () => {
      // Arrange
      const tree: JsonArray = [{ Root: [{ '#xml__comment': 'c\n=======\nd' }] }]

      // Act
      const out = await serializeToString(sut, tree, {}, { hasConflict: false })

      // Assert
      expect(out).toContain('<!--c\n=======\nd-->')
    })
  })

  describe.each([
    ['comment', { '#xml__comment': 'c\n=======\nd' }],
    ['CDATA', { __cdata: 'c\n>>>>>>> x\nd' }],
  ])(
    'given a %s marker-like line outside the sides of a merge that has a conflict',
    (_, content) => {
      it('when serialized then the merge is refused', async () => {
        // Arrange
        const tree: JsonArray = [
          {
            Root: [
              conflictOf([{ v: 'a' }], [{ v: 'b' }], [{ v: 'c' }]),
              content as JsonValue,
            ],
          },
        ]

        // Act
        const act = serializeToString(sut, tree, {})

        // Assert
        await expect(act).rejects.toThrow(
          'XML merge error: a comment or CDATA line in a file holding a conflict reads as a conflict marker'
        )
      })
    }
  )

  describe.each(['=======', '>>>>>>> theirs', '||||||| base'])(
    'given a one-line value %j that follows an opening tag in a conflict side',
    value => {
      it('when serialized then it is written as is', async () => {
        // Arrange
        const tree = inLocalSide(value)

        // Act
        const out = await serializeToString(sut, tree, {})

        // Assert
        expect(out).toContain(`<v>${value}</v>`)
      })
    }
  )

  describe('given a marker-like first line of an attribute value in a conflict side', () => {
    it('when serialized then it is written as is', async () => {
      // Arrange
      const tree = inLocalSide({ '@_a': '=======\ny', '#text': 't' })

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toContain('<v a="=======\ny">')
    })
  })

  describe('given a marker-like value on a line of its own in a conflict side', () => {
    it.each([
      ['text after a sibling element', { b: '1', '#text': '=======' }],
      ['text after a comment', { '#xml__comment': 'c', '#text': '=======' }],
    ])(
      'when serialized with %s then its first character is a character reference',
      async (_, body) => {
        // Arrange
        const tree = inLocalSide(body as JsonValue)

        // Act
        const out = await serializeToString(sut, tree, {})

        // Assert
        expect(out).toMatch(/^\s*&#61;======/m)
      }
    )

    it('when the side opens with bare text then it is escaped too', async () => {
      // Arrange
      const tree: JsonArray = [
        { Root: [conflictOf(['=======' as JsonValue], [], [])] },
      ]

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toMatch(/^\s*&#61;======/m)
      expect(lines(out).filter(l => l === '=======')).toHaveLength(1)
    })
  })

  describe('given a comment that follows a conflict block', () => {
    it('when serialized then it starts on a fresh indented line', async () => {
      // Arrange
      const tree: JsonArray = [
        {
          Root: [
            conflictOf([{ v: 'a' }], [{ v: 'b' }], [{ v: 'c' }]),
            { '#xml__comment': 'note' },
          ],
        },
      ]

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toContain('>>>>>>> theirs\n    <!--note-->\n</Root>')
    })
  })

  describe.each(['aaaaaaa', 'eeeeeee', '!!!!!!!', 'SSSSSSS', 'ttttttt'])(
    'given a text line %j that repeats a character no marker uses',
    line => {
      it('when serialized then it is written as is', async () => {
        // Arrange
        const tree = inLocalSide(`b\n${line}\nx`)

        // Act
        const out = await serializeToString(sut, tree, {})

        // Assert
        expect(lines(out)).toContain(line)
      })
    }
  )

  describe('given markers of one character', () => {
    const single = new XmlStreamWriter({
      ...defaultConfig,
      conflictMarkerSize: 1,
    })
    const inside = (content: JsonValue): JsonArray => [
      { Root: [conflictOf([{ v: 'a' }], [{ v: 'b' }], [{ v: 'c' }]), content] },
    ]

    it.each([
      ['a text', { v: '=' }, '<v>=</v>'],
      ['an attribute value', { v: { '@_a': '=', '#text': 'x' } }, '<v a="=">x'],
    ])(
      'when %s is one marker character then it is written as is',
      async (_, content, expected) => {
        // Arrange
        const tree = inside(content as JsonValue)

        // Act
        const out = await serializeToString(single, tree, {})

        // Assert
        expect(out).toContain(expected)
      }
    )

    it.each([
      ['a comment', { v: { '#xml__comment': '=' } }, '<!--=-->'],
      ['CDATA', { v: { __cdata: '>' } }, '<![CDATA[>]]>'],
    ])(
      'when %s is one marker character then it is not refused',
      async (_, content, expected) => {
        // Arrange
        const tree = inside(content as JsonValue)

        // Act
        const out = await serializeToString(single, tree, {})

        // Assert
        expect(out).toContain(expected)
      }
    )
  })

  describe('given a text that starts with a line break after a sibling in a file with a conflict', () => {
    it('when serialized then the indent left alone on its line is dropped', async () => {
      // Arrange
      const tree: JsonArray = [
        { Root: [{ a: '1' }, { '#text': '\nfoo\nbar' }] },
      ]

      // Act
      const out = await serializeToString(sut, tree, {})

      // Assert
      expect(out).toContain('<a>1</a>\nfoo\nbar</Root>')
    })
  })
})
