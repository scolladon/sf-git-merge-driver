import { describe, expect, it } from 'vitest'
import { scanDocument } from '../../../../src/adapter/parser/scanDocument.js'

describe('scanDocument', () => {
  describe('given a single leaf element', () => {
    it('when scanning then the root text is a scalar', () => {
      // Arrange
      const xml = '<r><v>1</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'parsed',
        result: { content: { r: { v: '1' } }, rootAttributes: {} },
        needsOracle: false,
      })
    })
  })

  describe.each([
    ['a no-break space', ' '],
    ['a byte order mark', '﻿'],
    ['a line separator', ' '],
    ['an em space', ' '],
  ])(
    'given text that ends with %s, which XML does not count as whitespace',
    (_, char) => {
      it('when scanning then the character is kept', () => {
        // Arrange
        const xml = `<r><v>Price:${char}</v><c><![CDATA[${char}x${char}]]></c></r>`

        // Act
        const outcome = scanDocument(xml)

        // Assert
        if (outcome.kind !== 'parsed') throw new Error('expected parsed')
        expect(outcome.result.content).toEqual({
          r: { v: `Price:${char}`, c: { __cdata: `${char}x${char}` } },
        })
      })
    }
  )

  describe('given text surrounded by every XML whitespace character', () => {
    it('when scanning then that whitespace is trimmed', () => {
      // Arrange
      const xml = '<r><v> \t\r\nx \t\r\n</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ r: { v: 'x' } })
    })
  })

  describe('given text on both sides of an element, each with surrounding whitespace', () => {
    it('when scanning then each segment is trimmed before concatenation', () => {
      // Arrange
      const xml = '<a> t1 <b>x</b> t2 </a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: { b: 'x', '#text': 't1t2' } })
    })
  })

  describe('given whitespace-only text in a leaf element', () => {
    it('when scanning then the text is discarded and the leaf is an empty string', () => {
      // Arrange
      const xml = '<a><b>  </b></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: { b: '' } })
    })
  })

  describe('given a close tag with no >', () => {
    it('when scanning then it fails as an unterminated tag', () => {
      // Arrange
      const xml = '<a><b>x</b'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated tag',
      })
    })
  })

  describe('given a lax close whose text contains the frame name', () => {
    it('when scanning then it pops the frame despite the extra characters', () => {
      // Arrange
      const xml = '<a><b>x</bb></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: { b: 'x' } })
    })
  })

  describe('given a close tag that does not contain the open frame name', () => {
    it('when scanning then it fails with the unexpected-close-tag message', () => {
      // Arrange
      const xml = '<a><bb>x</b></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'Unexpected close tag\nLine: 0\nColumn: 12\nChar: >',
      })
    })
  })

  describe('given an element named `<` and a close tag with an empty name', () => {
    it('when scanning then the `</` opener is not matched as part of the name', () => {
      // Arrange
      const xml = '<<>x</>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: invalid element name',
      })
    })
  })

  describe('given a close tag at the top level before any root was found', () => {
    it('when scanning then it needs the oracle and stops with no root', () => {
      // Arrange
      const xml = '</x><a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'parsed',
        result: { content: {}, rootAttributes: {} },
        needsOracle: true,
      })
    })
  })

  describe('given a close tag at the top level after the root was found', () => {
    it('when scanning then it needs the oracle, ends the scan, and keeps the root', () => {
      // Arrange
      const xml = '<a/></x><b>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'parsed',
        result: { content: { a: '' }, rootAttributes: {} },
        needsOracle: true,
      })
    })
  })

  describe('given a stray quote ahead of the real attribute quote in an open tag', () => {
    it('when scanning then it parses but flags needsOracle (defers to the balance pass)', () => {
      // Arrange
      const xml = '<a><b x"y="1">t</b></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(true)
    })
  })

  describe('given a quoted attribute name holding the stray quote (settled by the scan alone)', () => {
    it('when scanning then it parses, flags needsOracle, and the compacted result stands', () => {
      // Arrange
      const xml = '<a><b x"y"="1">t</b></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(true)
      expect(outcome.result.content).toEqual({
        a: { b: { '@_x"y"': '1', '#text': 't' } },
      })
    })
  })

  describe('given a quote inside a close tag (defers to the balance pass)', () => {
    it('when scanning then it pops the frame and flags needsOracle', () => {
      // Arrange
      const xml = "<a><b>x</b '></a>"

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(true)
      expect(outcome.result.content).toEqual({ a: { b: 'x' } })
    })
  })

  describe('given a quote inside a close tag attribute (settled by the scan alone)', () => {
    it('when scanning then the naive > search lands inside the quote and the leftover becomes trailing text', () => {
      // Arrange — indexOf('>', ...) is not quote-aware, so it matches
      // the '>' inside the quoted value; the '">' left over after that
      // point is then scanned as ordinary text on the parent frame.
      const xml = '<a><b>x</b x=">"></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(true)
      expect(outcome.result.content).toEqual({ a: { b: 'x', '#text': '">' } })
    })
  })

  describe('given an unterminated comment', () => {
    it('when scanning then it fails with the comment-specific message', () => {
      // Arrange
      const xml = '<a><!-- never closes'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated comment',
      })
    })
  })

  describe.each([
    ['<!-->', 5],
    ['<!--->', 6],
  ])(
    'given the short comment token %s (%i chars, defers to the balance pass)',
    token => {
      it('when scanning then it is kept verbatim as text and flags needsOracle', () => {
        // Arrange
        const xml = `<a>${token}</a>`

        // Act
        const outcome = scanDocument(xml)

        // Assert
        if (outcome.kind !== 'parsed') throw new Error('expected parsed')
        expect(outcome.needsOracle).toBe(true)
        expect(outcome.result.content).toEqual({ a: token })
      })
    }
  )

  describe('given the counterpart of the short comment raiser', () => {
    it('when scanning then the short token starts a text run that keeps trailing text', () => {
      // Arrange
      const xml = '<a><!-->t--></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(true)
      expect(outcome.result.content).toEqual({ a: '<!-->t-->' })
    })
  })

  describe('given the real empty comment <!----> (7 chars)', () => {
    it('when scanning then it is a genuine comment, not a needsOracle raiser', () => {
      // Arrange
      const xml = '<a><!----></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.needsOracle).toBe(false)
      expect(outcome.result.content).toEqual({ a: { '#xml__comment': '' } })
    })
  })

  describe('given a comment body kept verbatim', () => {
    it('when scanning then the body lands under #xml__comment', () => {
      // Arrange
      const xml = '<r><!-- foo --><v>1</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({
        r: { '#xml__comment': ' foo ', v: '1' },
      })
    })
  })

  describe('given a comment before the root element', () => {
    it('when scanning then it is refused as outside the root', () => {
      // Arrange
      const xml = '<!-- preamble --><r><v>1</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome.kind).toBe('failed')
    })
  })

  describe('given an unterminated CDATA section', () => {
    it('when scanning then it fails with the declaration message', () => {
      // Arrange
      const xml = '<a><![CDATA[x'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <! ... >',
      })
    })
  })

  describe('given an empty CDATA section', () => {
    it('when scanning then __cdata is an empty string', () => {
      // Arrange
      const xml = '<a><![CDATA[]]></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: { __cdata: '' } })
    })
  })

  describe('given a CDATA section with surrounding whitespace', () => {
    it('when scanning then the content is trimmed', () => {
      // Arrange
      const xml = '<a><![CDATA[  x  ]]></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: { __cdata: 'x' } })
    })
  })

  describe('given a CDATA section at the top level, before the root', () => {
    it('when scanning then it is content outside the root, like top-level text', () => {
      // Arrange
      const xml = '<![CDATA[x]]><a>1</a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe('given a CDATA section at the top level, after the root', () => {
    it('when scanning then it is content outside the root', () => {
      // Arrange
      const xml = '<a>1</a><![CDATA[x]]>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe('given a lowercase cdata token holding an unmatched quote', () => {
    it('when scanning then the case-sensitive mismatch falls to the declaration branch, which fails on the open quote', () => {
      // Arrange — the trailing quote never closes, so the quote-aware
      // declaration scan runs off the end looking for its match.
      const xml = "<a><![cdata[ ' ]]></a>"

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <! ... >',
      })
    })
  })

  describe('given an unterminated declaration', () => {
    it('when scanning then it fails with the declaration message', () => {
      // Arrange
      const xml = '<!DOCTYPE a'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <! ... >',
      })
    })
  })

  describe.each([
    ['a DOCTYPE before the root', '<!DOCTYPE r SYSTEM "x.dtd"><r><v>1</v></r>'],
    ['a DOCTYPE after the root', '<r><v>1</v></r><!DOCTYPE r>'],
    ['a DOCTYPE with a quoted >', '<!DOCTYPE a "x>y"><a><b>x</b></a>'],
  ])('given %s', (_, xml) => {
    it('when scanning then it is content outside the root, like a comment', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe('given a DOCTYPE with an internal subset', () => {
    it('when scanning then the leftover subset text is content outside the root', () => {
      // Arrange
      const xml = '<!DOCTYPE a [ <!ENTITY e "v"> ]><a>x</a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe.each([
    ['followed by a comment', '<a><!foo--><!-- c -->t</a>'],
    ['with a quoted > inside', '<a><!x "y>z">t</a>'],
  ])('given a declaration inside an element, %s', (_, xml) => {
    it('when scanning then it is refused instead of dropped', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: <! declaration inside the root element',
      })
    })
  })

  describe('given a comment opener with only one dash after the bang', () => {
    it('when scanning then it is not mistaken for a comment and is refused as a declaration', () => {
      // Arrange — the char at pos+2 is '-' (the comment fast-path
      // check alone would accept it), but the token does not actually
      // start with '<!--', so it must fall through to the declaration
      // branch instead of being read as a comment body.
      const xml = '<a><!- x --></a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: <! declaration inside the root element',
      })
    })
  })

  describe('given an unterminated processing instruction', () => {
    it('when scanning then it fails with the PI-specific message', () => {
      // Arrange
      const xml = '<?xml version="1.0"'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <? ?>',
      })
    })
  })

  describe('given a processing instruction that closes immediately with no content', () => {
    // Pins the `pos + PI_OPEN.length` search-from offset: searching from
    // `pos` instead would let the opener's own trailing `?` complete a
    // phantom `?>` one character early, at `<?` + `>`, instead of finding
    // the real close (or correctly failing when there is none).
    it('when scanning then it fails with the PI-specific message', () => {
      // Arrange
      const xml = '<a><?>x</a>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <? ?>',
      })
    })
  })

  describe.each([
    ['after the XML declaration', '<?xml version="1.0"?><a><?pi?>x</a>'],
    ['an XML declaration', '<a><?xml version="1.0"?>x</a>'],
  ])('given a processing instruction inside an element, %s', (_, xml) => {
    it('when scanning then it is refused instead of dropped', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message:
          'XML parse error: processing instruction inside the root element',
      })
    })
  })

  describe.each([
    [
      'a second declaration',
      '<?xml version="1.0"?><?xml version="1.0"?><a>x</a>',
    ],
    ['a declaration after the root', '<a>x</a><?xml version="1.0"?>'],
    ['a declaration after whitespace', '\n<?xml version="1.0"?><a>x</a>'],
    [
      'a declaration after a BOM and whitespace',
      '\uFEFF <?xml version="1.0"?><a>x</a>',
    ],
  ])('given %s', (_, xml) => {
    it('when scanning then it is refused as not at the start of the document', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message:
          'XML parse error: XML declaration not at the start of the document',
      })
    })
  })

  describe.each([
    ['before the root', '<?foo?><a>x</a>'],
    ['after the root', '<a>x</a><?foo?>'],
    ['a stylesheet', '<?xml-stylesheet href="a.css"?><a>x</a>'],
    ['a name that starts like the declaration', '<?xmlfoo?><a>x</a>'],
    [
      'a name that is the declaration, in capitals',
      '<?XML version="1.0"?><a>x</a>',
    ],
  ])('given a processing instruction: %s', (_, xml) => {
    it('when scanning then it is content outside the root, like a comment', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe.each([
    ['with attributes', '<?xml version="1.0"?><a>x</a>'],
    ['closing at once', '<?xml?><a>x</a>'],
    ['split by a line break', '<?xml\nversion="1.0"?><a>x</a>'],
  ])('given an XML declaration %s', (_, xml) => {
    it('when scanning then it is accepted', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: 'x' })
    })
  })

  describe('given an unterminated processing instruction preceded by a stray literal ?>', () => {
    it('when scanning then the PI search does not latch onto the earlier ?>', () => {
      // Arrange — searching from `pos - 2` instead of `pos + 2` would
      // find the stray "?>" that precedes the real PI and miss that it
      // never closes.
      const xml = '<a>?><?pi'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated <? ?>',
      })
    })
  })

  describe('given an unterminated open tag', () => {
    it('when scanning then it fails with the tag message', () => {
      // Arrange
      const xml = '<a><b'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: unterminated tag',
      })
    })
  })

  describe('given a self-closing root with a non-namespace attribute', () => {
    it('when scanning then it compacts without pushing a frame', () => {
      // Arrange
      const xml = '<a x="1"/>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: '' })
      expect(outcome.result.rootAttributes).toEqual({ '@_x': '1' })
    })
  })

  describe.each([
    'script',
    'style',
    'img',
    'br',
    'input',
    'meta',
    'link',
    'hr',
  ])('given the ordinary-name element <%s>', name => {
    it('when scanning then it round-trips exactly like any other name', () => {
      // Arrange
      const xml = `<a><${name} x="1">t</${name}></a>`

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({
        a: { [name]: { '@_x': '1', '#text': 't' } },
      })
    })
  })

  describe('given EOF with exactly one open frame', () => {
    it('when scanning then it fails at final depth 1', () => {
      // Arrange
      const xml = '<a>x'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: tags unbalanced (final depth 1)',
      })
    })
  })

  describe('given EOF with several open frames', () => {
    it('when scanning then it fails at the exact final depth', () => {
      // Arrange
      const xml = '<a><b><c>x'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: tags unbalanced (final depth 3)',
      })
    })
  })

  describe.each([
    ['two well-formed top-level elements', '<a>1</a><b>2</b>'],
    [
      'two top-level elements declaring a namespace',
      '<a xmlns="x"/><b xmlns="y"/>',
    ],
    ['a second root opened after a self-closed one', '<a/><b>2</b>'],
    ['a second root after a nested first one', '<a><c/></a><a>2</a>'],
  ])('given %s', (_, xml) => {
    it('when scanning then the document is refused', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe.each([
    ['text before the root', 'hello<a/>'],
    ['text after the root', '<a/>hello'],
    ['text only', 'hello'],
  ])('given %s', (_, xml) => {
    it('when scanning then the document is refused', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe.each([
    ['at the start', '<?xml version="1.0"?>\n<a>1</a>\n'],
    ['after a byte order mark', '\uFEFF<?xml version="1.0"?>\n<a>1</a>\n'],
  ])('given a declaration %s of the document', (_, xml) => {
    it('when scanning then the root is parsed', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ a: '1' })
    })
  })

  describe.each([
    ['a comment before', '<!-- c -->\n<a>1</a>'],
    ['a comment after', '<a>1</a>\n<!-- d -->\n'],
    ['an empty comment before', '<!---->\n<a>1</a>'],
    ['an empty comment after', '<a>1</a><!---->'],
  ])('given %s the root', (_, xml) => {
    it('when scanning then the content is refused as outside the root', () => {
      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'failed',
        message: 'XML parse error: content outside the single root element',
      })
    })
  })

  describe('given an error in a trailing top-level element after the root was found', () => {
    it('when scanning then the trailing element is still scanned and its error surfaces', () => {
      // Arrange
      const xml = '<a/><b></c>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome.kind).toBe('failed')
    })
  })

  describe('given namespace attributes mixed with an ordinary attribute on the root', () => {
    it('when scanning then every root attribute moves to the bucket in source order', () => {
      // Arrange — left on the element, `xsi:schemaLocation` would reach the
      // property-by-property merge and be written back as a child element.
      const xml =
        '<r xsi:schemaLocation="urn:x x.xsd" xmlns="http://x" xmlns:xsi="http://y"><v>1</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ r: { v: '1' } })
      expect(Object.entries(outcome.result.rootAttributes)).toEqual([
        ['@_xsi:schemaLocation', 'urn:x x.xsd'],
        ['@_xmlns', 'http://x'],
        ['@_xmlns:xsi', 'http://y'],
      ])
    })
  })

  describe('given only namespace attributes on the root', () => {
    it('when scanning then the element carries no attrs of its own', () => {
      // Arrange
      const xml = '<r xmlns="http://x" xmlns:xsi="http://y"><v>1</v></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({ r: { v: '1' } })
      expect(outcome.result.rootAttributes).toEqual({
        '@_xmlns': 'http://x',
        '@_xmlns:xsi': 'http://y',
      })
    })
  })

  describe('given a namespace attribute on a non-root element', () => {
    it('when scanning then it stays inline with the @_ prefix', () => {
      // Arrange
      const xml = '<r><inner xmlns:y="http://y"><v>1</v></inner></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      expect(outcome.result.content).toEqual({
        r: { inner: { '@_xmlns:y': 'http://y', v: '1' } },
      })
    })
  })

  describe('given no root element at all', () => {
    it('when scanning then content and rootAttributes are both empty', () => {
      // Arrange
      const xml = '<?xml nothing?>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'parsed',
        result: { content: {}, rootAttributes: {} },
        needsOracle: false,
      })
    })
  })

  describe('given completely empty input', () => {
    it('when scanning then content and rootAttributes are both empty', () => {
      // Arrange
      const xml = ''

      // Act
      const outcome = scanDocument(xml)

      // Assert
      expect(outcome).toEqual({
        kind: 'parsed',
        result: { content: {}, rootAttributes: {} },
        needsOracle: false,
      })
    })
  })

  describe('given a __proto__-named element', () => {
    it('when scanning then it round-trips as an ordinary own property', () => {
      // Arrange
      const xml = '<r><__proto__><v>1</v></__proto__></r>'

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      const rNode = (outcome.result.content as { r: object }).r as Record<
        string,
        unknown
      >
      expect(Object.keys(rNode)).toContain('__proto__')
      expect(Object.getPrototypeOf(rNode)).toBeNull()
    })
  })

  describe.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
    'given an element named after Object.prototype member %s',
    name => {
      it('when scanning then it is an own key holding its value', () => {
        // Arrange
        const xml = `<r><${name}>1</${name}></r>`

        // Act
        const outcome = scanDocument(xml)

        // Assert
        if (outcome.kind !== 'parsed') throw new Error('expected parsed')
        const rNode = (outcome.result.content as { r: object }).r as Record<
          string,
          unknown
        >
        expect(Object.hasOwn(rNode, name)).toBe(true)
        expect(rNode[name]).toBe('1')
      })
    }
  )

  describe.each([
    ['double', '<r><v attr="a>b"/></r>'],
    ['single', "<r><v attr='a>b'/></r>"],
  ])(
    'given a self-closing tag with a %s-quoted > in an attribute',
    (_, xml) => {
      it('when scanning then the tag still self-closes with the full value', () => {
        // Arrange — the input comes from the table above

        // Act
        const outcome = scanDocument(xml)

        // Assert
        expect(outcome).toEqual({
          kind: 'parsed',
          needsOracle: false,
          result: {
            content: { r: { v: { '@_attr': 'a>b', '#text': '' } } },
            rootAttributes: {},
          },
        })
      })
    }
  )

  describe('given 20,000 levels of nesting', () => {
    it('when scanning then it parses without a stack overflow', () => {
      // Arrange
      const depth = 20000
      const xml = `${'<e>'.repeat(depth)}x${'</e>'.repeat(depth)}`

      // Act
      const outcome = scanDocument(xml)

      // Assert
      if (outcome.kind !== 'parsed') throw new Error('expected parsed')
      let node: unknown = outcome.result.content['e']
      for (let i = 1; i < depth; i++) {
        node = (node as Record<string, unknown>)['e']
      }
      expect(node).toBe('x')
    })
  })
})
