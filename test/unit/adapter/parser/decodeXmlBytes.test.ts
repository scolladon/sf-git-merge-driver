import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import {
  decodeXmlBytes,
  INVALID_UTF8,
  UTF16_UNSUPPORTED,
  unsupportedEncoding,
} from '../../../../src/adapter/parser/decodeXmlBytes.js'

// Hand-encoded payloads: one non-ASCII character per legacy codec.
const LATIN1_E_ACUTE = [0xe9]
const WINDOWS_1252_EURO = [0x80]
const SHIFT_JIS_NIHON = [0x93, 0xfa, 0x96, 0x7b]

const withPayload = (
  encoding: string | undefined,
  payload: readonly number[]
): Buffer => {
  const [head, tail] = doc(encoding, '@').split('@')
  return Buffer.concat([
    Buffer.from(head),
    Buffer.from(payload),
    Buffer.from(tail),
  ])
}

const doc = (encoding: string | undefined, text: string): string => {
  const decl =
    encoding === undefined
      ? '<?xml version="1.0"?>'
      : `<?xml version="1.0" encoding="${encoding}"?>`
  return `${decl}\n<r><d>${text}</d></r>\n`
}

describe('decodeXmlBytes', () => {
  describe.each([
    ['ISO-8859-1', LATIN1_E_ACUTE],
    ['windows-1252', WINDOWS_1252_EURO],
    ['Shift_JIS', SHIFT_JIS_NIHON],
  ])('given a file declared %s', (name, payload) => {
    it('when decoded then it is refused with the declared encoding named', () => {
      // Arrange
      const bytes = withPayload(name, payload)

      // Act & Assert
      expect(() => decodeXmlBytes(bytes)).toThrow(unsupportedEncoding(name))
    })
  })

  describe.each(['UTF-8', 'utf-8', 'utf8', 'US-ASCII', 'ascii'])(
    'given a file declared %s',
    name => {
      it('when decoded then the text is returned unchanged', () => {
        const xml = doc(name, 'café')
        expect(decodeXmlBytes(Buffer.from(xml))).toBe(xml)
      })
    }
  )

  describe('given a single-quoted encoding declaration', () => {
    it('when decoded then it is checked like a double-quoted one', () => {
      const xml = "<?xml version='1.0' encoding='ISO-8859-1'?><r/>"
      expect(() => decodeXmlBytes(Buffer.from(xml))).toThrow(
        unsupportedEncoding('ISO-8859-1')
      )
    })
  })

  describe('given no encoding declaration or no declaration at all', () => {
    it.each([doc(undefined, 'café'), '<r>café</r>', '<?xml version="1.0"'])(
      'when decoded then %j is accepted',
      xml => {
        expect(decodeXmlBytes(Buffer.from(xml))).toBe(xml)
      }
    )
  })

  describe('given invalid UTF-8 bytes with no declaration', () => {
    it('when decoded then it is refused', () => {
      const bytes = Buffer.concat([
        Buffer.from('<r>caf'),
        Buffer.from([0xe9]),
        Buffer.from('</r>'),
      ])
      expect(() => decodeXmlBytes(bytes)).toThrow(INVALID_UTF8)
    })
  })

  describe('given a literal U+FFFD in valid UTF-8', () => {
    it('when decoded then it is kept as text', () => {
      const xml = '<r>a�b</r>'
      expect(decodeXmlBytes(Buffer.from(xml))).toBe(xml)
    })
  })

  describe('given a UTF-8 BOM', () => {
    it('when decoded then the BOM is kept for the scanner to skip', () => {
      const xml = `﻿${doc('UTF-8', 'x')}`
      expect(decodeXmlBytes(Buffer.from(xml))).toBe(xml)
    })

    it('when the declared encoding is not UTF-8 then it is still refused', () => {
      const xml = `﻿${doc('ISO-8859-1', 'x')}`
      expect(() => decodeXmlBytes(Buffer.from(xml))).toThrow(
        unsupportedEncoding('ISO-8859-1')
      )
    })
  })

  describe.each([
    ['UTF-16LE with BOM', Buffer.from('﻿<r/>', 'utf16le')],
    ['UTF-16BE with BOM', Buffer.from([0xfe, 0xff, 0x00, 0x3c])],
    ['UTF-16LE without BOM', Buffer.from('<r/>', 'utf16le')],
    ['UTF-16BE without BOM', Buffer.from([0x00, 0x3c, 0x00, 0x72])],
  ])('given %s', (_title, bytes) => {
    it('when decoded then it is refused with an encoding message', () => {
      expect(() => decodeXmlBytes(bytes)).toThrow(UTF16_UNSUPPORTED)
    })
  })

  describe('given an empty input', () => {
    it('when decoded then the empty string is returned', () => {
      expect(decodeXmlBytes(Buffer.alloc(0))).toBe('')
    })
  })
})

describe('decodeXmlBytes messages', () => {
  describe('given a file the pipeline cannot read', () => {
    it.each([
      [
        'a UTF-16 file',
        Buffer.from('<r/>', 'utf16le'),
        'XML encoding error: UTF-16 is not supported, only UTF-8',
      ],
      [
        'invalid UTF-8',
        Buffer.from([0x3c, 0xe9]),
        'XML encoding error: input is not valid UTF-8',
      ],
      [
        'a declared legacy encoding',
        Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><r/>'),
        'XML encoding error: declared encoding "ISO-8859-1" is not supported, only UTF-8',
      ],
    ])(
      'when decoding %s then the message names the cause',
      (_, bytes, message) => {
        // Arrange
        const sut = () => decodeXmlBytes(bytes)

        // Act & Assert
        expect(sut).toThrow(new Error(message))
      }
    )
  })

  describe('given bytes that open like a UTF-16 file in one byte only', () => {
    it.each([[[0xff, 0x41]], [[0x41, 0xfe]], [[0xfe, 0x41]], [[0x41, 0xff]]])(
      'when decoding %j then they are refused as invalid UTF-8',
      bytes => {
        // Arrange
        const sut = () => decodeXmlBytes(Buffer.from(bytes))

        // Act & Assert
        expect(sut).toThrow(new Error(INVALID_UTF8))
      }
    )

    it.each([
      [[0x41, 0x00], 'A\0'],
      [[0x00, 0x41], '\0A'],
      [[0x41, 0x3c], 'A<'],
    ])('when decoding %j then the text is returned', (bytes, text) => {
      // Arrange
      const sut = decodeXmlBytes

      // Act
      const result = sut(Buffer.from(bytes))

      // Assert
      expect(result).toBe(text)
    })
  })

  describe('given text that only looks like an encoding declaration', () => {
    it.each([
      [
        'an element that is not a declaration',
        '<r>encoding="ISO-8859-1"?></r>',
      ],
      ['an unclosed declaration', '<?xml version="1.0" encoding="ISO-8859-1" '],
      [
        'an attribute after the declaration',
        '<?xml version="1.0"?><r encoding="ISO-8859-1"/>',
      ],
    ])('when decoding %s then it is returned unchanged', (_, xml) => {
      // Arrange
      const sut = decodeXmlBytes

      // Act
      const result = sut(Buffer.from(xml))

      // Assert
      expect(result).toBe(xml)
    })
  })

  describe.each([
    [
      'a space before the equal sign',
      '<?xml version="1.0" encoding ="ISO-8859-1"?><r/>',
    ],
    [
      'a space after the equal sign',
      '<?xml version="1.0" encoding= "ISO-8859-1"?><r/>',
    ],
  ])('given %s', (_, xml) => {
    it('when decoding then the declaration is read all the same', () => {
      // Arrange
      const sut = () => decodeXmlBytes(Buffer.from(xml))

      // Act & Assert
      expect(sut).toThrow(
        new Error(
          'XML encoding error: declared encoding "ISO-8859-1" is not supported, only UTF-8'
        )
      )
    })
  })
})

describe('CompactXmlParser.parseStream encoding', () => {
  const sut = new CompactXmlParser()

  describe('given a multi-byte character split across chunk boundaries', () => {
    it('when streamed byte by byte then it is accepted and intact', async () => {
      // Arrange
      const bytes = Buffer.from('<r><d>café 日本 😀</d></r>')
      const chunks = Array.from(bytes, b => Buffer.from([b]))

      // Act
      const result = await sut.parseStream(Readable.from(chunks))

      // Assert
      expect(result.content).toEqual({ r: { d: 'café 日本 😀' } })
    })
  })

  describe('given a Latin-1 declared stream', () => {
    it('when parsed then it rejects with the encoding message', async () => {
      const bytes = withPayload('ISO-8859-1', LATIN1_E_ACUTE)
      await expect(sut.parseStream(Readable.from([bytes]))).rejects.toThrow(
        unsupportedEncoding('ISO-8859-1')
      )
    })
  })
})
