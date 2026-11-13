import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { lexOpenTag } from '../../../../src/adapter/parser/lexOpenTag.js'
import type { JsonObject } from '../../../../src/types/jsonTypes.js'
import {
  lexOutcomeOf,
  parseOutcomeOf,
  parseSeeds,
  xmlEditArb,
} from '../../../utils/adapterArbitraries.js'
import { CompactXmlParser as FrameScanParser } from '../../../utils/oracles/frameScan/CompactXmlParser.js'
import { lexOpenTag as frameScanLexOpenTag } from '../../../utils/oracles/frameScan/lexOpenTag.js'
import { listParityInputs, parseOutcome } from '../../../utils/parserParity.js'
import {
  merge,
  orderedTypes,
  render,
  sidesArb,
  unorderedTypes,
} from '../../merger/laws/arbitraries.js'

// Each run merges, renders and parses twice; under v8 coverage on a loaded
// machine that outlasts the default timeout
const ORACLE_PROPERTY_TIMEOUT_MS = 60_000

const MEDIUM_TIER = 'medium'
const ROOT_NAME = 'a'
const CHILD_NAME = 'b'
const NAME_PLACEHOLDER = 'NAME'
const MAX_CHILDREN = 6

const TAG_NAMES = ['b', 'bb', "b'", 'b"', '_b', ':b', 'é', 'x-y']
const TAG_TAILS = [
  '>',
  ' >',
  '/>',
  ' />',
  ' x="1">',
  '\t>',
  '\n>',
  '',
  ' x',
  '/',
  ' x="1',
  "'>",
  '>t',
]

const LEAF_NAMES = ['b', 'bb', "b'"]
const ATTRIBUTES = ['', ' x="1"']
const LEAF_TEXTS = ['', 'x', ' x ', '  ', '\n x\n', 'x>y', '1 < 2']
const LEAF_MIDDLES = ['', '<c>y</c>', '<!--c-->', '<![CDATA[y]]>', '<c/>']
const LEAF_CLOSES = [
  '</NAME>',
  '</NAME >',
  '</NAMEx>',
  '</c>',
  '</ NAME>',
  '</NAME',
  '',
]
const LEAF_TRAILERS = ['', '<b>z</b>', 't']

const CHILDREN = [
  '<b>1</b>',
  '<b>2</b>',
  '<c>3</c>',
  '<__proto__>p</__proto__>',
  '<__cdata>k</__cdata>',
  '<![CDATA[d]]>',
  '<!--m-->',
  't',
  '<b x="1">4</b>',
  '<b/>',
  '<constructor>c</constructor>',
]

const sut = new CompactXmlParser()
const oracle = new FrameScanParser()

const expectOracleOutcome = (xml: string): void => {
  expect(parseOutcomeOf(sut, xml)).toBe(parseOutcomeOf(oracle, xml))
}

// The large and xl tiers belong to the parity suite: here they would only
// add minutes
const mediumTierDocuments = (): readonly string[] =>
  listParityInputs()
    .tiers.filter(([tier]) => tier === MEDIUM_TIER)
    .flatMap(([, documents]) => documents)

const realisticXmlArb = fc
  .constantFrom(...unorderedTypes, ...orderedTypes)
  .chain(spec => sidesArb(spec).map(sides => ({ spec, sides })))

const tagEndArb = fc.record({
  name: fc.constantFrom(...TAG_NAMES),
  tail: fc.constantFrom(...TAG_TAILS),
})

const leafArb = fc.record({
  wrapped: fc.boolean(),
  name: fc.constantFrom(...LEAF_NAMES),
  attr: fc.constantFrom(...ATTRIBUTES),
  text: fc.constantFrom(...LEAF_TEXTS),
  middle: fc.constantFrom(...LEAF_MIDDLES),
  close: fc.constantFrom(...LEAF_CLOSES),
  trailer: fc.constantFrom(...LEAF_TRAILERS),
})

const leafDocumentArb = leafArb.map(leaf => {
  const close = leaf.close.replace(NAME_PLACEHOLDER, leaf.name)
  const element = `<${leaf.name}${leaf.attr}>${leaf.text}${leaf.middle}${close}${leaf.trailer}`
  return leaf.wrapped ? `<a>${element}</a>` : element
})

const childStoreDocumentArb = fc
  .record({
    attr: fc.constantFrom(...ATTRIBUTES),
    children: fc.array(fc.constantFrom(...CHILDREN), {
      maxLength: MAX_CHILDREN,
    }),
  })
  .map(({ attr, children }) => `<a><p${attr}>${children.join('')}</p></a>`)

const okOutcome = (content: string): string =>
  `ok:{"content":${content},"rootAttributes":{}}`

const childOf = (element: JsonObject, name: string): JsonObject =>
  element[name] as JsonObject

const rootElementOf = (xml: string): JsonObject =>
  childOf(sut.parseString(xml).content as JsonObject, ROOT_NAME)

describe('CompactXmlParser against the frame-per-element scan', () => {
  describe('given every seed document and the medium profile tier', () => {
    it(
      'when parsed then the outcome is the reference outcome',
      () => {
        // Arrange
        const documents = parseSeeds().concat(mediumTierDocuments())

        // Act
        const result = documents.map(xml => parseOutcomeOf(sut, xml))

        // Assert
        expect(result).toEqual(
          documents.map(xml => parseOutcomeOf(oracle, xml))
        )
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given a merged and rendered document', () => {
    it(
      'when parsed then the outcome is the reference outcome',
      async () => {
        // Arrange
        const property = fc.asyncProperty(
          realisticXmlArb,
          async ({ spec, sides }) => {
            const xml = await render(merge(spec, ...sides).output)
            expectOracleOutcome(xml)
          }
        )

        // Act & Assert
        await fc.assert(property)
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given a seed document under byte edits', () => {
    it(
      'when parsed then the outcome is the reference outcome',
      () => {
        // Arrange
        const property = fc.property(
          xmlEditArb(parseSeeds()),
          expectOracleOutcome
        )

        // Act & Assert
        fc.assert(property)
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given an open tag ending every way a tag can end', () => {
    it('when lexed and parsed then both outcomes are the reference ones', () => {
      // Arrange
      const property = fc.property(tagEndArb, ({ name, tail }) => {
        const tag = `<${name}${tail}`
        expect(lexOutcomeOf(lexOpenTag, tag)).toBe(
          lexOutcomeOf(frameScanLexOpenTag, tag)
        )
        expectOracleOutcome(`<a>${tag}t</${name}></a>`)
      })

      // Act & Assert
      fc.assert(property)
    })
  })

  describe('given an element that may be a text leaf', () => {
    it('when parsed then the outcome is the reference outcome', () => {
      // Arrange
      const property = fc.property(leafDocumentArb, expectOracleOutcome)

      // Act & Assert
      fc.assert(property)
    })
  })

  describe('given an element with repeated, hostile and mixed children', () => {
    it('when parsed then the outcome is the reference outcome', () => {
      // Arrange
      const property = fc.property(childStoreDocumentArb, expectOracleOutcome)

      // Act & Assert
      fc.assert(property)
    })
  })

  describe('given an open tag', () => {
    it.each([
      [
        '<b>',
        {
          kind: 'tag',
          name: 'b',
          attrs: {},
          hasAttrs: false,
          end: 3,
          selfClosing: false,
          strayQuote: false,
        },
      ],
      [
        '<b >',
        {
          kind: 'tag',
          name: 'b',
          attrs: {},
          hasAttrs: false,
          end: 4,
          selfClosing: false,
          strayQuote: false,
        },
      ],
      [
        "<b'>",
        {
          kind: 'tag',
          name: "b'",
          attrs: {},
          hasAttrs: false,
          end: 4,
          selfClosing: false,
          strayQuote: true,
        },
      ],
      ['<b', { kind: 'unterminated' }],
      [
        '<b/>',
        {
          kind: 'tag',
          name: 'b',
          attrs: {},
          hasAttrs: false,
          end: 4,
          selfClosing: true,
          strayQuote: false,
        },
      ],
      [
        '<b x="1">',
        {
          kind: 'tag',
          name: 'b',
          attrs: { x: '1' },
          hasAttrs: true,
          end: 9,
          selfClosing: false,
          strayQuote: false,
        },
      ],
    ])('when %j is lexed then it reads as the reference', (tag, expected) => {
      // Arrange
      const reference = lexOutcomeOf(frameScanLexOpenTag, tag)

      // Act
      const result = lexOpenTag(tag, 0)

      // Assert
      expect(result).toEqual(expected)
      expect(lexOutcomeOf(lexOpenTag, tag)).toBe(reference)
    })
  })

  describe('given a leaf, a close tag or a malformed element', () => {
    it.each([
      ['<a><b>x</b></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a><b> x </b></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a><b></b></a>', okOutcome('{"a":{"b":""}}')],
      ['<a><b>x</bb></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a><b>x</b ></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a><b>x</ b></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a><b>\n  x\n</b></a>', okOutcome('{"a":{"b":"x"}}')],
      ['<a>x</a>', okOutcome('{"a":"x"}')],
      [
        '<a><b>x</b><c>1</c><b>y</b><b>z</b></a>',
        okOutcome('{"a":{"b":["x","y","z"],"c":"1"}}'),
      ],
      [
        '<a><b>x</b><b><c>1</c></b></a>',
        okOutcome('{"a":{"b":["x",{"c":"1"}]}}'),
      ],
      ['<a><b x="1"></b></a>', okOutcome('{"a":{"b":{"@_x":"1","#text":""}}}')],
      [
        '<a><b x="1">t</b></a>',
        okOutcome('{"a":{"b":{"@_x":"1","#text":"t"}}}'),
      ],
      [
        '<a><b>x</c></a>',
        'throw:Unexpected close tag\nLine: 0\nColumn: 11\nChar: >',
      ],
      [
        "<a><b'>x</b'></a>",
        'throw:XML parse error: tags unbalanced (final depth 1)',
      ],
      ['<a><b>x</b', 'throw:XML parse error: unterminated tag'],
      ['<a><b>x', 'throw:XML parse error: tags unbalanced (final depth 2)'],
      ['<a><1>x</1></a>', 'throw:XML parse error: invalid element name'],
      [
        '<a><__proto__>x</__proto__><__proto__>y</__proto__></a>',
        okOutcome('{"a":{"__proto__":["x","y"]}}'),
      ],
      [
        '<a><__cdata>x</__cdata><![CDATA[y]]></a>',
        okOutcome('{"a":{"__cdata":["x","y"]}}'),
      ],
      [
        '<a><b x="1"><c>2</c>t</b></a>',
        okOutcome('{"a":{"b":{"@_x":"1","c":"2","#text":"t"}}}'),
      ],
      ['<a><b/></a>', okOutcome('{"a":{"b":""}}')],
    ])('when %j is parsed then it reads as the reference', (xml, expected) => {
      // Act
      const result = parseOutcome(sut, xml)

      // Assert
      expect(result).toBe(expected)
      expectOracleOutcome(xml)
    })
  })

  describe('given repeated __proto__ elements', () => {
    it('when parsed then their parent has no prototype', () => {
      // Arrange
      const xml = '<a><__proto__>x</__proto__><__proto__>y</__proto__></a>'

      // Act
      const result = Object.getPrototypeOf(rootElementOf(xml))

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('given an element with an attribute, a child and text', () => {
    it('when parsed then its keys run attribute, child, text', () => {
      // Arrange
      const xml = '<a><b x="1"><c>2</c>t</b></a>'

      // Act
      const result = Object.keys(childOf(rootElementOf(xml), CHILD_NAME))

      // Assert
      expect(result).toEqual(['@_x', 'c', '#text'])
    })
  })
})
