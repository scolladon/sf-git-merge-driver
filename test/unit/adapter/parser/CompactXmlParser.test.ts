import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { PARSER_BEHAVIOUR_CHANGES } from '../../../utils/parserBehaviourChanges.js'
import { parseOutcome } from '../../../utils/parserParity.js'

describe('CompactXmlParser', () => {
  const sut = new CompactXmlParser()

  describe('given a well-formed document with no needsOracle raiser', () => {
    it('when parseString then it returns the scanned result untouched', () => {
      const result = sut.parseString('<r><v>1</v></r>')
      expect(result.content).toEqual({ r: { v: '1' } })
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given a scan failure that the oracle also rejects', () => {
    it('when parseString then the oracle message wins (both agree here)', () => {
      expect(() => sut.parseString('<a><b')).toThrow(
        'XML parse error: unterminated tag'
      )
    })
  })

  describe('given a scan failure that the oracle does not reject (a P5 unwind row)', () => {
    it("when parseString then the scanner's own message is thrown", () => {
      // The mismatched close `</b>` for open frame `bb` fails the
      // scanner's lax-name check, but assertBalancedTags only counts
      // depth (+1/-1), and this document is depth-balanced.
      expect(() => sut.parseString('<a><bb>x</b></a>')).toThrow(
        'Unexpected close tag\nLine: 0\nColumn: 12\nChar: >'
      )
    })
  })

  describe('given a scan failure and an oracle failure with different messages', () => {
    it("when parseString then the oracle's balance message wins over the scanner's own", () => {
      // The mismatched close fails the scanner with "Unexpected close
      // tag" before EOF, but the document is also genuinely unbalanced
      // (one open frame never closes), so the oracle's own depth-count
      // message must be the one that surfaces.
      expect(() => sut.parseString('<a><bb>x</b>')).toThrow(
        'XML parse error: tags unbalanced (final depth 1)'
      )
    })
  })

  describe('given a stray quote in an open tag (needsOracle witness)', () => {
    it('when parseString then the oracle throws over the scanned result', () => {
      expect(() => sut.parseString('<a><b x"y="1">t</b></a>')).toThrow(
        'XML parse error: unterminated tag'
      )
    })
  })

  describe('given a stray quote in an open tag (needsOracle counterpart)', () => {
    it('when parseString then the oracle passes and the scanned result stands', () => {
      const result = sut.parseString('<a><b x"y"="1">t</b></a>')
      expect(result.content).toEqual({
        a: { b: { '@_x"y"': '1', '#text': 't' } },
      })
    })
  })

  describe('given 20,000 levels of nesting', () => {
    it('when parseString then it parses without a stack overflow', () => {
      const depth = 20000
      const xml = `${'<e>'.repeat(depth)}x${'</e>'.repeat(depth)}`

      const result = sut.parseString(xml)

      let node: unknown = result.content['e']
      for (let i = 1; i < depth; i++) {
        node = (node as Record<string, unknown>)['e']
      }
      expect(node).toBe('x')
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

  describe('given completely empty input', () => {
    it('when parseString then content + namespaces are both empty objects', () => {
      const result = sut.parseString('')
      expect(result.content).toEqual({})
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given input with trailing whitespace after the root element', () => {
    it('when parseString then the trailing whitespace is ignored and parsing succeeds', () => {
      const result = sut.parseString(`<r><v>1</v></r>\n  \n`)
      expect(result.content).toEqual({ r: { v: '1' } })
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

  describe('given a DOCTYPE prologue', () => {
    it('when parseString then the DOCTYPE is skipped and the root is parsed normally', () => {
      const result = sut.parseString(
        `<!DOCTYPE r SYSTEM "x.dtd"><r><v>1</v></r>`
      )
      expect(result.content).toEqual({ r: { v: '1' } })
    })

    it('when parseString and the DOCTYPE itself is unterminated then it throws with the <! ... > message', () => {
      expect(() => sut.parseString(`<!DOCTYPE r`)).toThrow(/unterminated <!/i)
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

  describe('given a valueless attribute on the root element', () => {
    it('when parseString then it round-trips without throwing', () => {
      const result = sut.parseString(`<r foo><v>1</v></r>`)
      expect(result.content).toEqual({ r: { '@_foo': null, v: '1' } })
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

  describe('given a comment that precedes the root element', () => {
    it('when parseString then the comment is skipped and the root is still found', () => {
      const result = sut.parseString(`<!-- preamble --><r><v>1</v></r>`)
      expect(result.content).toEqual({ r: { v: '1' } })
    })
  })

  describe('given a CDATA section', () => {
    it('when parseString then it lands under __cdata, verbatim', () => {
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

    it('when parseString and CDATA is surrounded by text on both sides then both are preserved', () => {
      const result = sut.parseString(`<r><v>before<![CDATA[raw]]>after</v></r>`)
      expect(result.content).toEqual({
        r: { v: { __cdata: 'raw', '#text': 'beforeafter' } },
      })
    })

    it('when parseString and CDATA contains a literal &lt; entity then the entity is preserved verbatim', () => {
      // A literal &lt; inside CDATA must round-trip unchanged — silent
      // corruption of escaped markup inside a CDATA section would
      // corrupt any Salesforce metadata carrying it.
      const result = sut.parseString(`<r><v><![CDATA[a&lt;b&amp;c]]></v></r>`)
      expect(result.content).toEqual({
        r: { v: { __cdata: 'a&lt;b&amp;c' } },
      })
    })

    it('when parseString and there are repeated CDATA-bearing siblings then they collapse into an array of objects', () => {
      const result = sut.parseString(
        `<r><v><![CDATA[a]]></v><v><![CDATA[b]]></v></r>`
      )
      expect(result.content).toEqual({
        r: { v: [{ __cdata: 'a' }, { __cdata: 'b' }] },
      })
    })
  })

  describe('given XML entities in text', () => {
    it('when parseString then the entities are preserved verbatim (writer round-trips them)', () => {
      const result = sut.parseString(`<r><v>1 &amp; 2</v></r>`)
      expect(result.content).toEqual({ r: { v: '1 &amp; 2' } })
    })
  })

  describe('given input outside the Salesforce shape', () => {
    it.each(Object.entries(PARSER_BEHAVIOUR_CHANGES))(
      "when parsing %s then the scanner's outcome is pinned",
      (_label, { xml, outcome }) => {
        expect(parseOutcome(sut, xml)).toBe(outcome)
      }
    )
  })
})
