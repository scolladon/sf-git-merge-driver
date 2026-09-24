import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  parsedToTNodes,
  sentinelTextOf,
  type TNode,
  TxmlXmlParser,
} from '../../../src/adapter/TxmlXmlParser.js'
import type { JsonObject } from '../../../src/types/jsonTypes.js'
import { PARSER_BEHAVIOUR_CHANGES } from '../../utils/parserBehaviourChanges.js'
import { parseOutcome } from '../../utils/parserParity.js'

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

    it('when parseString and CDATA is surrounded by text on both sides then both are preserved', () => {
      // Pins CDATA_RE's lazy `*?` quantifier — a greedy `*` would
      // eat across multiple CDATA blocks; this case keeps the regex honest.
      const result = sut.parseString(`<r><v>before<![CDATA[raw]]>after</v></r>`)
      expect(result.content).toEqual({
        r: { v: { __cdata: 'raw', '#text': 'beforeafter' } },
      })
    })

    it('when parseString and CDATA contains a literal &lt; entity then the entity is preserved verbatim', () => {
      // Pins the `& before <` order in preprocessCdata's escape pass
      // (and the symmetric decode order in decodeCdataEscape). If either
      // were swapped, the literal `&lt;` would round-trip as `<` —
      // silent corruption of any SF metadata containing escaped markup
      // inside a CDATA section.
      const result = sut.parseString(`<r><v><![CDATA[a&lt;b&amp;c]]></v></r>`)
      expect(result.content).toEqual({
        r: { v: { __cdata: 'a&lt;b&amp;c' } },
      })
    })

    it('when parseString and there are repeated CDATA-bearing siblings then they collapse into an array of objects', () => {
      // Exercises the sentinel handling INSIDE the repeated-sibling
      // collapse path — a different code path from the multi-segment-
      // in-one-element case above.
      const result = sut.parseString(
        `<r><v><![CDATA[a]]></v><v><![CDATA[b]]></v></r>`
      )
      expect(result.content).toEqual({
        r: { v: [{ __cdata: 'a' }, { __cdata: 'b' }] },
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

  describe('given input with trailing whitespace after the root element', () => {
    // Pins assertBalancedTags's `next < 0 break` exit path: the
    // tag-scan loop finishes iterating tags but the input still has
    // unconsumed bytes (whitespace), so indexOf returns -1 and we
    // break out instead of looping forever.
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

    it('when parseString and an attr name ENDS with "xmlns" but is not "xmlns" itself then it stays on the element', () => {
      // Pins the `^` anchor in XMLNS_RE — without it, `data-xmlns`
      // would be misrouted into the namespaces bucket.
      const result = sut.parseString(`<r data-xmlns="x"><v>1</v></r>`)
      expect(result.content).toEqual({ r: { '@_data-xmlns': 'x', v: '1' } })
      expect(result.namespaces).toEqual({})
    })

    it('when parseString and an attr name STARTS with "xmlns" but has trailing chars then it stays on the element', () => {
      // Pins the `$` anchor in XMLNS_RE — without it, `xmlnsfoo`
      // would be misrouted into the namespaces bucket. The optional
      // `(?::.+)?` group already allows `xmlns:xsi`, but a bare
      // suffix without `:` must NOT match.
      const result = sut.parseString(`<r xmlnsfoo="x"><v>1</v></r>`)
      expect(result.content).toEqual({ r: { '@_xmlnsfoo': 'x', v: '1' } })
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given a valueless attribute on the root element', () => {
    it('when parseString then it round-trips without throwing', () => {
      // txml emits `null` (not a string) for a valueless attribute —
      // pins that splitRootAttrs tolerates that shape without throwing
      const result = sut.parseString(`<r foo><v>1</v></r>`)
      expect(result.content).toEqual({ r: { '@_foo': null, v: '1' } })
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

  describe('given a DOCTYPE prologue (which Salesforce metadata never emits, but we must not false-throw on)', () => {
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

  describe('given an attribute value containing > (legal in XML but rare in SF metadata)', () => {
    it('when parseString then the > inside quotes is not mistaken for the tag terminator', () => {
      // Without the quote-aware tag-end scan, the bracket inside
      // attr="a>b" would make assertBalancedTags chop the open tag in
      // half and falsely throw "tags unbalanced" on otherwise valid XML.
      const result = sut.parseString(`<r><v attr="a>b">x</v></r>`)
      expect(result.content).toEqual({
        r: { v: { '@_attr': 'a>b', '#text': 'x' } },
      })
    })

    it('when parseString and the > is inside a SELF-CLOSING tag attr then depth tracking still ends at zero', () => {
      // Pins the quote-tracking branches in findTagEnd — without
      // them, a stray `>` inside an attribute would be treated as
      // a tag terminator, making the open tag lose its trailing `/`
      // (so it counts as +1 depth instead of 0). The unmatched
      // depth would then trip assertBalancedTags. The "x>y" + "/>"
      // combination is the smallest input that exposes this.
      expect(() => sut.parseString(`<r><v attr="a>b"/></r>`)).not.toThrow()
    })

    it('when parseString and a single-quoted attribute contains a > then it is also handled', () => {
      // Pins the second branch of `ch === "'"` in findTagEnd's
      // quote-set check.
      const result = sut.parseString(`<r><v attr='a>b'>x</v></r>`)
      expect(result.content).toEqual({
        r: { v: { '@_attr': 'a>b', '#text': 'x' } },
      })
    })

    it('when parseString and a SELF-CLOSING tag has a single-quoted attr containing > then depth tracking still ends at zero', () => {
      // The self-close + single-quote combination is what forces the
      // single-quote branch of `ch === '"' || ch === "'"` to actually
      // gate the depth count — without it, the open tag drops its
      // trailing `/` and registers as +1 depth (caught by
      // assertBalancedTags). The non-self-closing single-quote test
      // above happens to balance out (one bad open + one normal close
      // = depth 0) so it does NOT exercise this branch.
      expect(() => sut.parseString(`<r><v attr='a>b'/></r>`)).not.toThrow()
    })
  })

  describe('given a quote that appears only in text, never inside a tag', () => {
    it('when parseString then the balance pass is unaffected by it', () => {
      const result = sut.parseString(`<a>it's "ok"</a>`)
      expect(result.content).toEqual({ a: `it's "ok"` })
    })
  })

  describe('given a tag carrying a quoted attribute followed by a quote-free tag', () => {
    it('when parseString then the trailing tag still balances correctly', () => {
      // Pins the quote-cursor refresh: once `next` moves past a quote
      // seen in an earlier tag, the cursor must catch up rather than
      // keep reporting a quote inside every later tag.
      const result = sut.parseString(`<a><b x="1">t</b><c>u</c></a>`)
      expect(result.content).toEqual({
        a: { b: { '@_x': '1', '#text': 't' }, c: 'u' },
      })
    })
  })

  describe('given a stray quote ahead of the real attribute quote in a tag', () => {
    it('when parseString then it throws with the unterminated-tag message', () => {
      expect(() => sut.parseString(`<a><b x"y="1">t</b></a>`)).toThrow(
        /unterminated tag/i
      )
    })
  })

  describe('given a self-closing root followed by a stray extra close tag', () => {
    it('when parseString then it throws on the unbalanced count', () => {
      expect(() => sut.parseString(`<a/></a>`)).toThrow(
        /unbalanced \(final depth -1\)/i
      )
    })
  })

  describe('given a quote character sitting exactly at the tag-scan cursor', () => {
    // Pins the `!== -1` "no cached quote" guard in elementTagEnd's
    // quoteInsideTag check against the specific numeral -1, not just
    // any falsy/boundary value — a tag whose own leading quote is at
    // absolute index 1 is the only witness that tells -1 apart from
    // an arbitrary other index.
    it('when parseString and the quote is double then the quote-aware scan still wins', () => {
      const result = sut.parseString(`<"x>y"/>`)
      expect(result.content).toEqual({ '"x': 'y"/>' })
    })

    it('when parseString and the quote is single then the quote-aware scan still wins', () => {
      const result = sut.parseString(`<'x>y'/>`)
      expect(result.content).toEqual({ "'x": "y'/>" })
    })
  })

  describe('given a comment body containing a stray < near its closing -->', () => {
    it('when parseString then the comment resumes exactly after its own -->', () => {
      // Pins skipDeclaration's `end + 3` resume offset: landing 3
      // chars short would re-discover the embedded '<' as a bogus
      // open tag instead of the real element that follows.
      const result = sut.parseString(`<a><!--<x-->y</a>`)
      expect(result.content).toEqual({
        a: { '#xml__comment': '<x', '#text': 'y' },
      })
    })
  })

  describe('given a non-comment declaration containing an empty <> near its close', () => {
    it('when parseString then the declaration resumes exactly after its own >', () => {
      // Pins skipDeclaration's `end + 1` resume offset for the
      // generic <! ... > branch.
      const result = sut.parseString(`<a><!x<>z</a>`)
      expect(result.content).toEqual({ a: '!x<z' })
    })
  })

  describe('given a processing instruction preceded by a stray literal ?>', () => {
    it('when parseString then the PI search does not latch onto the earlier ?>', () => {
      // Pins the `next + 2` search-from offset for the <? ?> branch —
      // searching from `next - 2` would find the stray "?>" that
      // precedes the real PI and never make forward progress.
      const result = sut.parseString(`<a>?><?pi?>z</a>`)
      expect(result.content).toEqual({ a: { '?pi?': '', '#text': '?>z' } })
    })
  })

  describe('given a processing instruction body containing a stray <', () => {
    it('when parseString then the PI resumes exactly after its own ?>', () => {
      // Pins skipDeclaration's `end + 2` resume offset for the <? ?>
      // branch.
      const result = sut.parseString(`<a><?pi <x?>y</a>`)
      expect(result.content).toEqual({
        a: { '?pi': { '@_x?': null, '#text': '' }, '#text': 'y' },
      })
    })
  })

  describe('given an element named after the #text key', () => {
    it('when parseString then it stays a sibling key, never collapsing the parent to a scalar', () => {
      // Pins unboxScalar's `keys.length === 1` guard: without it, a
      // node whose FIRST inserted key happens to be literally '#text'
      // (from a same-named child) would wrongly unbox to that child's
      // value alone, discarding the sibling 'b' key.
      const result = sut.parseString(`<a><#text>x</#text><b>y</b></a>`)
      expect(result.content).toEqual({ a: { '#text': 'x', b: 'y' } })
    })
  })

  describe('given an attribute-bearing leaf whose body is whitespace-only', () => {
    it('when parseString then the whitespace is dropped, not kept as #text', () => {
      // Pins the `.trim()` in the general path's textBuf check — this
      // node has attrs, so it takes the general path, not the leaf
      // fast path (whose own `.trim()` is covered elsewhere).
      const result = sut.parseString(`<a><style x="1">   </style></a>`)
      expect(result.content).toEqual({ a: { style: { '@_x': '1' } } })
    })
  })

  describe('given a single XML comment as the sole child of an element', () => {
    it('when parseString then it falls through to the comment branch, not the leaf text fast path', () => {
      const result = sut.parseString(`<a><b><!--c--></b></a>`)
      expect(result.content).toEqual({ a: { b: { '#xml__comment': 'c' } } })
    })
  })

  describe('given text starting with < that is not a well-formed comment', () => {
    it('when parseString then it falls through to classifyChildren as literal text', () => {
      const result = sut.parseString(`<a><!-->t--></a>`)
      expect(result.content).toEqual({ a: '<!-->t-->' })
    })
  })

  describe('given whitespace-only text in a leaf element (the toCompact fast path)', () => {
    it('when parseString then it collapses to a null-prototype empty object', () => {
      const result = sut.parseString(`<a><style>  </style></a>`)
      const styleNode = (result.content as JsonObject)['a'] as JsonObject

      expect(styleNode['style']).toEqual({})
      expect(Object.getPrototypeOf(styleNode['style'])).toBeNull()
    })
  })

  describe('given a __proto__-named element (prototype-pollution guard)', () => {
    it('when parseString then it round-trips as an ordinary own property visible in Object.keys', () => {
      const result = sut.parseString(`<r><__proto__><v>1</v></__proto__></r>`)
      const rNode = (result.content as JsonObject)['r'] as JsonObject

      expect(Object.keys(rNode)).toContain('__proto__')
      expect(rNode['__proto__']).toEqual({ v: '1' })
    })

    // Separate from the observable contract above because it pins the
    // remedy rather than the behaviour, and a weaker remedy that keeps a
    // normal prototype would still satisfy the assertions above while
    // leaving `node['__proto__']` resolving to Object.prototype on nodes
    // that lack the key — which misclassifies the merge scenario.
    it('when parseString then the compact node carries no prototype chain', () => {
      const result = sut.parseString(`<r><__proto__><v>1</v></__proto__></r>`)
      const rNode = (result.content as JsonObject)['r'] as JsonObject

      expect(Object.getPrototypeOf(rNode)).toBeNull()
    })
  })

  describe('given elements named after other Object.prototype members (regression guard)', () => {
    // These names are plain data properties on Object.prototype, so
    // assigning them was already safe pre-fix (the assignment shadows
    // them with an own property) — pin that it stays true post-fix.
    it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
      'when parseString then %s round-trips as an ordinary own property',
      name => {
        const result = sut.parseString(`<r><${name}>1</${name}></r>`)
        const rNode = (result.content as JsonObject)['r'] as JsonObject

        expect(Object.keys(rNode)).toContain(name)
        expect(rNode[name]).toBe('1')
      }
    )
  })

  describe('given input outside the Salesforce shape', () => {
    it.each(Object.entries(PARSER_BEHAVIOUR_CHANGES))(
      "when parsing %s then today's outcome is pinned",
      (_label, { xml, outcome }) => {
        expect(parseOutcome(sut, xml)).toBe(outcome)
      }
    )
  })
})

// Direct tests for defensive guards that are unreachable through
// black-box parseString calls (txml's real output never trips them).
describe('TxmlXmlParser internals (defensive guards)', () => {
  describe('parsedToTNodes', () => {
    describe('given an array', () => {
      it('when called then the same array is returned (narrowed to the TNode shape)', () => {
        const input: unknown = [{ tagName: 'r', attributes: {}, children: [] }]
        expect(parsedToTNodes(input)).toBe(input)
      })
    })

    describe('given a non-array (a future txml release that broke the contract)', () => {
      it('when called then it throws a descriptive error including the actual type', () => {
        expect(() => parsedToTNodes({ wrong: 'shape' })).toThrow(
          /expected an array/i
        )
        expect(() => parsedToTNodes(null)).toThrow(/expected an array/i)
      })
    })
  })

  describe('sentinelTextOf', () => {
    describe('given a sentinel TNode whose children are all strings (the production case)', () => {
      it('when called then the strings are concatenated', () => {
        const node: TNode = {
          tagName: '\x00cdata\x00',
          attributes: {},
          children: ['part-a', 'part-b'],
        }
        expect(sentinelTextOf(node)).toBe('part-apart-b')
      })
    })

    describe('given a sentinel TNode that contains a nested TNode (a future txml release that broke the all-strings precondition)', () => {
      it('when called then the nested TNode is silently filtered out, NOT stringified as [object Object]', () => {
        const node: TNode = {
          tagName: '\x00cdata\x00',
          attributes: {},
          children: [
            'before',
            { tagName: 'leaked', attributes: {}, children: [] },
            'after',
          ],
        }
        expect(sentinelTextOf(node)).toBe('beforeafter')
      })
    })
  })
})
