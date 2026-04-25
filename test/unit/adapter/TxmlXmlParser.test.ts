import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { TxmlXmlParser } from '../../../src/adapter/TxmlXmlParser.js'

describe('TxmlXmlParser', () => {
  const sut = new TxmlXmlParser()

  describe('given a single leaf element', () => {
    it('when parseString then text is unboxed to a scalar', () => {
      const result = sut.parseString(`<r><v>1</v></r>`)
      expect(result.content).toEqual({ r: { v: '1' } })
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given an element with no body', () => {
    it('when parseString then it serialises as an empty string', () => {
      expect(sut.parseString(`<r><v/></r>`).content).toEqual({ r: { v: '' } })
      expect(sut.parseString(`<r><v></v></r>`).content).toEqual({
        r: { v: '' },
      })
    })
  })

  describe('given an attribute-only element with no body', () => {
    it('when parseString then attrs land under @_, plus an explicit empty #text', () => {
      const result = sut.parseString(`<r><v a="x"/></r>`)
      expect(result.content).toEqual({
        r: { v: { '@_a': 'x', '#text': '' } },
      })
    })
  })

  describe('given an attribute element wrapping text', () => {
    it('when parseString then attrs and #text are siblings', () => {
      const result = sut.parseString(`<r><v a="x">1</v></r>`)
      expect(result.content).toEqual({
        r: { v: { '@_a': 'x', '#text': '1' } },
      })
    })
  })

  describe('given repeated same-name siblings', () => {
    it('when parseString then they collapse into an array', () => {
      const result = sut.parseString(`<r><v>1</v><v>2</v><v>3</v></r>`)
      expect(result.content).toEqual({ r: { v: ['1', '2', '3'] } })
    })
  })

  describe('given mixed text + element content', () => {
    it('when parseString then text is concatenated under #text', () => {
      const result = sut.parseString(`<r>before<v>1</v>after</r>`)
      expect(result.content).toEqual({
        r: { v: '1', '#text': 'beforeafter' },
      })
    })
  })

  describe('given XML comments inside an element', () => {
    it('when parseString then the comment body lands under #xml__comment', () => {
      const result = sut.parseString(`<r><!-- foo --><v>1</v></r>`)
      expect(result.content).toEqual({
        r: { '#xml__comment': ' foo ', v: '1' },
      })
    })

    it('when parseString and there are multiple comments then bodies group as an array', () => {
      const result = sut.parseString(`<r><!-- a --><v>1</v><!-- b --></r>`)
      expect(result.content).toEqual({
        r: { '#xml__comment': [' a ', ' b '], v: '1' },
      })
    })
  })

  describe('given a CDATA section', () => {
    it('when parseString then it lands under __cdata, decoded byte-for-byte', () => {
      const result = sut.parseString(
        `<r><v><![CDATA[raw < & > stuff]]></v></r>`
      )
      expect(result.content).toEqual({
        r: { v: { __cdata: 'raw < & > stuff' } },
      })
    })

    it('when parseString and CDATA spans multiple segments with text between then __cdata is an array', () => {
      const result = sut.parseString(
        `<r><v><![CDATA[a]]>middle<![CDATA[b]]></v></r>`
      )
      expect(result.content).toEqual({
        r: { v: { __cdata: ['a', 'b'], '#text': 'middle' } },
      })
    })
  })

  describe('given namespace attributes on the root element', () => {
    it('when parseString then xmlns* are routed to the namespaces bucket', () => {
      const result = sut.parseString(
        `<r xmlns="http://x" xmlns:xsi="http://y"><v>1</v></r>`
      )
      expect(result.content).toEqual({ r: { v: '1' } })
      expect(result.namespaces).toEqual({
        '@_xmlns': 'http://x',
        '@_xmlns:xsi': 'http://y',
      })
    })
  })

  describe('given namespace attributes on a non-root element', () => {
    it('when parseString then they stay on the element with @_ prefix', () => {
      const result = sut.parseString(
        `<r xmlns="http://x"><inner xmlns:y="http://y"><v>1</v></inner></r>`
      )
      expect(result.content).toEqual({
        r: { inner: { '@_xmlns:y': 'http://y', v: '1' } },
      })
      expect(result.namespaces).toEqual({ '@_xmlns': 'http://x' })
    })
  })

  describe('given whitespace-only text between elements', () => {
    it('when parseString then the whitespace is discarded', () => {
      const result = sut.parseString(`<r>   <v>1</v>   </r>`)
      expect(result.content).toEqual({ r: { v: '1' } })
    })
  })

  describe('given XML entities in text', () => {
    it('when parseString then the entities are preserved verbatim (writer round-trips them)', () => {
      const result = sut.parseString(`<r><v>1 &amp; 2</v></r>`)
      expect(result.content).toEqual({ r: { v: '1 &amp; 2' } })
    })
  })

  describe('given input read from a Readable stream', () => {
    it('when parseStream then produces the same tree as parseString', async () => {
      const xml = `<?xml version="1.0"?><r xmlns="http://x"><v>1</v></r>`
      const fromString = sut.parseString(xml)
      const fromStream = await sut.parseStream(Readable.from([xml]))
      expect(fromStream).toEqual(fromString)
    })
  })

  describe('given three parseStream calls running in parallel', () => {
    it('when awaited together then all produce correct trees (no shared state)', async () => {
      const inputs = [
        `<?xml version="1.0"?><A><v>1</v></A>`,
        `<?xml version="1.0"?><B><v>2</v></B>`,
        `<?xml version="1.0"?><C><v>3</v></C>`,
      ]
      const results = await Promise.all(
        inputs.map(s => sut.parseStream(Readable.from([s])))
      )
      expect(results[0]!.content).toEqual({ A: { v: '1' } })
      expect(results[1]!.content).toEqual({ B: { v: '2' } })
      expect(results[2]!.content).toEqual({ C: { v: '3' } })
    })
  })

  describe('given completely empty input', () => {
    it('when parseString then content + namespaces are both empty objects', () => {
      const result = sut.parseString('')
      expect(result.content).toEqual({})
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given malformed input — unclosed element', () => {
    it('when parseString then it throws (so MergeDriver can surface the failure as a conflict)', () => {
      expect(() =>
        sut.parseString(`<?xml version="1.0"?><Profile><broken>`)
      ).toThrow(/unbalanced/i)
    })
  })

  describe('given malformed input — extra closing tag', () => {
    it('when parseString then it throws on the unbalanced count', () => {
      expect(() => sut.parseString(`<r><v>1</v></r></extra>`)).toThrow(
        /unbalanced/i
      )
    })
  })

  describe('given malformed input — unterminated comment', () => {
    it('when parseString then it throws with the comment-specific message', () => {
      expect(() => sut.parseString(`<r><!-- never closes`)).toThrow(
        /unterminated comment/i
      )
    })
  })

  describe('given malformed input — unterminated tag', () => {
    it('when parseString then it throws with the tag-specific message', () => {
      expect(() => sut.parseString(`<r><v`)).toThrow(/unterminated tag/i)
    })
  })

  describe('given malformed input — unterminated processing instruction', () => {
    it('when parseString then it throws with the PI-specific message', () => {
      expect(() => sut.parseString(`<?xml version="1.0"`)).toThrow(
        /unterminated/i
      )
    })
  })

  describe('given input with a root self-closing element', () => {
    it('when parseString then it produces a singleton with empty content', () => {
      const result = sut.parseString(`<r/>`)
      expect(result.content).toEqual({ r: '' })
    })
  })

  describe('given non-namespace attributes on the root element', () => {
    it('when parseString then they stay on the element with @_ prefix (not in the namespaces bucket)', () => {
      const result = sut.parseString(`<r foo="x" xmlns="http://x"><v>1</v></r>`)
      expect(result.content).toEqual({ r: { '@_foo': 'x', v: '1' } })
      expect(result.namespaces).toEqual({ '@_xmlns': 'http://x' })
    })
  })

  describe('given a comment that precedes the root element', () => {
    it('when parseString then the comment is skipped and the root is still found', () => {
      const result = sut.parseString(`<!-- preamble --><r><v>1</v></r>`)
      expect(result.content).toEqual({ r: { v: '1' } })
    })
  })

  describe('given a Readable yielding Buffer chunks (typical of fs streams)', () => {
    it('when parseStream then the bytes are concatenated and parsed', async () => {
      const stream = Readable.from([
        Buffer.from('<r><v>', 'utf8'),
        Buffer.from('x</v></r>', 'utf8'),
      ])
      const result = await sut.parseStream(stream)
      expect(result.content).toEqual({ r: { v: 'x' } })
    })
  })

  describe('given a Readable yielding string chunks', () => {
    it('when parseStream then the strings are concatenated and parsed', async () => {
      const stream = Readable.from(['<r><v>x', '</v></r>'])
      const result = await sut.parseStream(stream)
      expect(result.content).toEqual({ r: { v: 'x' } })
    })
  })
})
