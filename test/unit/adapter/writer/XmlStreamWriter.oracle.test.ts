import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type {
  WriteOptions,
  XmlSerializer,
} from '../../../../src/adapter/XmlSerializer.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '../../../../src/types/jsonTypes.js'
import {
  bagArb,
  parseOutcomeOf,
  parseSeeds,
  type WriterCase,
  writeOutcomeOf,
  writerCaseArb,
} from '../../../utils/adapterArbitraries.js'
import { XmlStreamWriter as WrapperWalkWriter } from '../../../utils/oracles/wrapperWalkWriter.js'
import { listParityInputs } from '../../../utils/parserParity.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'
import {
  merge,
  orderedTypes,
  ROOT_ATTRIBUTES,
  sidesArb,
  unorderedTypes,
} from '../../merger/laws/arbitraries.js'

// Each run writes a whole document two to four times with both writers;
// under v8 coverage on a loaded machine that outlasts the default timeout
const ORACLE_PROPERTY_TIMEOUT_MS = 60_000

const MEDIUM_TIER = 'medium'
const PARSED_PREFIX = 'ok:'
const DECL = '<?xml version="1.0" encoding="UTF-8"?>'

const OPTIONS: readonly WriteOptions[] = [
  { hasConflict: false, eol: '\n' },
  { hasConflict: false, eol: '\r\n' },
  { hasConflict: true, eol: '\n' },
  { hasConflict: true, eol: '\r\n' },
]
const FLAG_OPTIONS: readonly WriteOptions[] = [
  { hasConflict: false },
  { hasConflict: true },
]
const CONFLICT_OPTIONS: readonly WriteOptions[] = [
  { hasConflict: true, eol: '\n' },
  { hasConflict: true, eol: '\r\n' },
]

// Strings the leaf test tells apart: a value, the empty string, a value
// breaking its line and one whose second line reads as a marker
const BODY_STRINGS = ['x', '', 'l1\nl2', 'a\n<<<<<<< ours']
const BODY_SCALARS = [0, 7, true, false, null, undefined] as JsonValue[]

// Element names and every first character that keeps a key off the element
// walk: `@`, `#` and `_`
const BODY_KEYS = [
  'b',
  'c',
  '@_x',
  '#text',
  '__cdata',
  '#xml__comment',
  '__conflict',
  '__proto__',
  '_u',
  '',
  'b\nc',
]
const MAX_BODIES = 3

// Two levels reach an element-only body under an element-only body
const BODY_MAX_DEPTH = 2

// The wide body spreads over eleven keys, so an object of element names only
// comes up about three times in a hundred, and one whose repeats are all
// empty or that holds a conflict block once or never: the bodies below each
// decide one of these tests in every run
const ELEMENT_KEYS = ['b', 'c', '', 'b\nc']
const REFUSED_KEYS = [
  '@_x',
  '#text',
  '#xml__comment',
  '__cdata',
  '__conflict',
  '__proto__',
  '_u',
]
const MAX_ELEMENTS_AROUND = 2

// An empty repeat as likely as a leaf: every key of a small object then
// often holds one
const EMPTY_REPEAT_WEIGHT = 2
const LEAF_WEIGHT = 2
const BLOCK_WEIGHT = 1

const OPENING_NAMES = ['b', 'b\nc', 'b\n \nc', 'b\n\t<<<<<<< q']
const OPENING_ATTRIBUTES: readonly JsonObject[] = [
  {},
  { '@_x': '1' },
  { '@_x': 'v\nw' },
]
const OPENING_BODIES: readonly JsonValue[] = ['x', '', { c: 'y' }]
// The second line of `a` reads as a marker: under the conflict flag the root
// slot's attributes are escaped like any value
const OPENING_ROOT_ATTRIBUTES: JsonObject = {
  '@_xmlns': 'u',
  '@_a': 'x\n=======',
}
const CONTESTED_ROOT = {
  local: { '@_xmlns': 'u' },
  ancestor: { '@_xmlns': 'v' },
  other: { '@_xmlns': 'w' },
}

// A carriage return or a line separator after the marker keeps the indent
// regex from matching the rest of its line
const LINE_TAGS = ['base', 'base\r', 'base ', 'base\u2028']
// The last text is the word a marker read past the end of the marker list
// would match: a line starting with it must keep its indent
const LINE_TEXTS = ['v1\n   \nv2', '\t\n', 'x', 'undefined']
const LINE_NAMES = ['b\n\t<<<<<<< q', 'b\n  ', 'b']

// The filter reads the document in 16 KiB windows: padding of about that
// length puts the window's edge inside the lines around the conflict block
const MIN_PADDING = 16_300
const MAX_PADDING = 16_420
const PADDING_CHAR = 'x'

interface WriterPair {
  readonly sut: XmlStreamWriter
  readonly oracle: XmlSerializer
}

interface OpeningCase {
  readonly name: string
  readonly attributes: JsonObject
  readonly body: JsonValue
  readonly atRoot: boolean
  readonly contested: boolean
}

interface LineCase {
  readonly tags: readonly [string, string, string]
  readonly padding: number
  readonly text: string
  readonly name: string
}

const pairOf = (config: MergeConfig): WriterPair => ({
  sut: new XmlStreamWriter(config),
  oracle: new WrapperWalkWriter(config),
})

const writers = pairOf(defaultConfig)
const sut = writers.sut
const oracle = writers.oracle

const expectOracleOutcomes = async (
  pair: WriterPair,
  cases: readonly WriterCase[]
): Promise<void> => {
  for (const { ordered, rootAttributes, options } of cases) {
    expect(
      await writeOutcomeOf(pair.sut, ordered, rootAttributes, options)
    ).toBe(await writeOutcomeOf(pair.oracle, ordered, rootAttributes, options))
  }
}

const casesOf = (
  ordered: JsonArray,
  rootAttributes: JsonObject,
  options: readonly WriteOptions[]
): WriterCase[] =>
  options.map(option => ({ ordered, rootAttributes, options: option }))

const conflictOf = (
  local: JsonArray,
  ancestor: JsonArray,
  other: JsonArray
): JsonValue => ({ __conflict: true as const, local, ancestor, other })

const block = conflictOf([{ c: 'L' }], [], [{ c: 'O' }])

// The large and xl tiers belong to the parity suite: here they would only
// add minutes
const mediumTierDocuments = (): readonly string[] =>
  listParityInputs()
    .tiers.filter(([tier]) => tier === MEDIUM_TIER)
    .flatMap(([, documents]) => documents)

const parser = new CompactXmlParser()

// A document the parser refuses never reaches a writer
const isParsed = (xml: string): boolean =>
  parseOutcomeOf(parser, xml).startsWith(PARSED_PREFIX)

const parsedCasesOf = (xml: string): WriterCase[] => {
  const { content, rootAttributes } = parser.parseString(xml)
  return casesOf([content], rootAttributes, OPTIONS)
}

const realisticTreeArb = fc
  .constantFrom(...unorderedTypes, ...orderedTypes)
  .chain(spec => sidesArb(spec).map(sides => merge(spec, ...sides)))

const leafBodyArb: fc.Arbitrary<JsonValue> = fc.constantFrom(
  ...BODY_STRINGS,
  ...BODY_SCALARS
)

const childValueArb: fc.Arbitrary<JsonValue> = fc.oneof(
  { weight: EMPTY_REPEAT_WEIGHT, arbitrary: fc.constant<JsonValue>([]) },
  { weight: LEAF_WEIGHT, arbitrary: leafBodyArb },
  { weight: BLOCK_WEIGHT, arbitrary: fc.constant(block) }
)

const elementsBodyArb = bagArb(ELEMENT_KEYS, childValueArb)

const elementEntriesArb = fc.array(
  fc.tuple(fc.constantFrom(...ELEMENT_KEYS), childValueArb),
  { maxLength: MAX_ELEMENTS_AROUND }
)

// One key the element walk refuses, among element names on either side
const refusedBodyArb: fc.Arbitrary<JsonValue> = fc
  .tuple(
    elementEntriesArb,
    fc.tuple(fc.constantFrom(...REFUSED_KEYS), childValueArb),
    elementEntriesArb
  )
  .map(([before, refused, after]) =>
    Object.fromEntries(before.concat([refused], after))
  )

const bodyArb: fc.Arbitrary<JsonValue> = fc.letrec<{ body: JsonValue }>(
  tie => ({
    body: fc.oneof(
      { maxDepth: BODY_MAX_DEPTH, depthIdentifier: 'body' },
      leafBodyArb,
      fc.array(tie('body'), { maxLength: MAX_BODIES }),
      bagArb(BODY_KEYS, fc.oneof(tie('body'), fc.constant<JsonValue>([]))),
      fc.constant(block)
    ),
  })
).body

const bodyCasesOf = (body: JsonValue): WriterCase[] =>
  casesOf([{ Root: { a: body } }], {}, FLAG_OPTIONS).concat(
    casesOf([{ a: body }], {}, FLAG_OPTIONS)
  )

const openingArb: fc.Arbitrary<OpeningCase> = fc.record({
  name: fc.constantFrom(...OPENING_NAMES),
  attributes: fc.constantFrom(...OPENING_ATTRIBUTES),
  body: fc.constantFrom(...OPENING_BODIES),
  atRoot: fc.boolean(),
  contested: fc.boolean(),
})

// The wide opening needs no root slot, no attribute and a name with no line
// break at once, about four runs in a hundred: here only the name decides
const nestedPlainOpeningArb: fc.Arbitrary<OpeningCase> = fc.record({
  name: fc.constantFrom(...OPENING_NAMES),
  attributes: fc.constant({}),
  body: fc.constantFrom(...OPENING_BODIES),
  atRoot: fc.constant(false),
  contested: fc.boolean(),
})

const elementOf = ({ attributes, body }: OpeningCase): JsonValue => {
  if (Object.keys(attributes).length === 0) return body
  if (typeof body === 'object') return { ...attributes, ...body }
  return { ...attributes, '#text': body }
}

const openingCasesOf = (opening: OpeningCase): WriterCase[] => {
  const element = { [opening.name]: elementOf(opening) }
  const ordered = opening.atRoot ? [element] : [{ Root: element }]
  const options = FLAG_OPTIONS.map(option =>
    opening.contested ? { ...option, contested: CONTESTED_ROOT } : option
  )
  return casesOf(ordered, OPENING_ROOT_ATTRIBUTES, options)
}

const lineArb: fc.Arbitrary<LineCase> = fc.record({
  tags: fc.tuple(
    fc.constantFrom(...LINE_TAGS),
    fc.constantFrom(...LINE_TAGS),
    fc.constantFrom(...LINE_TAGS)
  ),
  padding: fc.integer({ min: MIN_PADDING, max: MAX_PADDING }),
  text: fc.constantFrom(...LINE_TEXTS),
  name: fc.constantFrom(...LINE_NAMES),
})

const linePairOf = ({ tags }: LineCase): WriterPair =>
  pairOf({
    ...defaultConfig,
    localConflictTag: tags[0],
    ancestorConflictTag: tags[1],
    otherConflictTag: tags[2],
  })

// A text after a sibling starts on a laid-out line of its own: the first line
// of a text is not a line of the value, so a blank one there is dropped
const lineCasesOf = ({ padding, text, name }: LineCase): WriterCase[] => {
  const root = [
    { p: PADDING_CHAR.repeat(padding) },
    { b: text },
    text,
    { [name]: 'x' },
    { d: conflictOf([{ c: text }], [], [{ c: 'O' }]) },
    { e: text },
  ]
  return casesOf([{ Root: root }], {}, CONFLICT_OPTIONS)
}

const documentOf = (text: string): string => `${DECL}\n${text}\n`

const onBothFlags = (
  rows: ReadonlyArray<readonly [JsonObject, string]>
): Array<[JsonObject, boolean, string]> =>
  rows.flatMap(([tree, expected]) => [
    [tree, false, expected],
    [tree, true, expected],
  ])

// The literal outputs of the sut, each also checked chunk by chunk against
// the reference
const expectLiteral = async (
  pair: WriterPair,
  tree: JsonObject,
  options: WriteOptions,
  expected: string
): Promise<void> => {
  const result = await serializeToString(pair.sut, [tree], {}, options)
  expect(result).toBe(expected)
  await expectOracleOutcomes(pair, casesOf([tree], {}, [options]))
}

describe('XmlStreamWriter against the wrapper walk', () => {
  describe('given every parsed seed document and the medium profile tier', () => {
    it(
      'when written then the chunks are the reference chunks',
      async () => {
        // Arrange
        const cases = parseSeeds()
          .concat(mediumTierDocuments())
          .filter(isParsed)
          .flatMap(parsedCasesOf)

        // Act & Assert
        await expectOracleOutcomes(writers, cases)
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given a merged tree', () => {
    it(
      'when written then the chunks are the reference chunks',
      async () => {
        // Arrange
        const property = fc.asyncProperty(realisticTreeArb, ({ output }) =>
          expectOracleOutcomes(
            writers,
            casesOf(output, ROOT_ATTRIBUTES, FLAG_OPTIONS)
          )
        )

        // Act & Assert
        await fc.assert(property)
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given a random tree with hostile keys and values', () => {
    it(
      'when written then the outcome is the reference outcome',
      async () => {
        // Arrange
        const property = fc.asyncProperty(writerCaseArb, writerCase =>
          expectOracleOutcomes(writers, [writerCase])
        )

        // Act & Assert
        await fc.assert(property)
      },
      ORACLE_PROPERTY_TIMEOUT_MS
    )
  })

  describe('given an element body of every kind', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(bodyArb, body =>
        expectOracleOutcomes(writers, bodyCasesOf(body))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given a string, number, boolean, null or undefined body', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(leafBodyArb, body =>
        expectOracleOutcomes(writers, bodyCasesOf(body))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given a body of element names holding leaves, empty repeats or a conflict', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(elementsBodyArb, body =>
        expectOracleOutcomes(writers, bodyCasesOf(body))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given a body of element names and one attribute, content or underscore key', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(refusedBodyArb, body =>
        expectOracleOutcomes(writers, bodyCasesOf(body))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given a nested opening with no attribute', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(nestedPlainOpeningArb, opening =>
        expectOracleOutcomes(writers, openingCasesOf(opening))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given an opening with or without root slot, attribute or line break', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(openingArb, opening =>
        expectOracleOutcomes(writers, openingCasesOf(opening))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given conflict lines around the edge of a filter window', () => {
    it('when written then the outcome is the reference outcome', async () => {
      // Arrange
      const property = fc.asyncProperty(lineArb, line =>
        expectOracleOutcomes(linePairOf(line), lineCasesOf(line))
      )

      // Act & Assert
      await fc.assert(property)
    })
  })

  describe('given a body the walk writes the same under both flags', () => {
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
      ])
    )(
      'when %j is written with conflict flag %s then it reads as the reference',
      async (tree, hasConflict, expected) => {
        // Act & Assert
        await expectLiteral(
          writers,
          tree,
          { hasConflict },
          documentOf(expected)
        )
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
      // An indented line starting with the word `undefined` is no marker line
      [
        { Root: [{ b: 'x' }, 'undefined'] },
        true,
        documentOf('<Root>\n    <b>x</b>\n    undefined</Root>'),
      ],
    ])(
      'when %j is written with conflict flag %s then it reads as the reference',
      async (tree, hasConflict, expected) => {
        // Act & Assert
        await expectLiteral(writers, tree, { hasConflict }, expected)
      }
    )
  })

  describe('given an ancestor tag ending on a carriage return', () => {
    it('when a conflict is written then the indent before its marker stays', async () => {
      // Arrange
      const pair = pairOf({ ...defaultConfig, ancestorConflictTag: 'base\r' })
      const expected = documentOf(
        '<a>\n<<<<<<< ours\n    <c>L</c>\n    ||||||| base\r\n=======\n    <c>O</c>\n>>>>>>> theirs\n</a>'
      )

      // Act & Assert
      await expectLiteral(
        pair,
        { a: { b: block } },
        { hasConflict: true },
        expected
      )
    })
  })

  describe('given a conflict flag present without its sides', () => {
    it.each(FLAG_OPTIONS)(
      'when written with %j then it throws as the reference',
      async options => {
        // Arrange
        const ordered = [{ a: { __conflict: true } }]

        // Act
        const result = await writeOutcomeOf(sut, ordered, {}, options)

        // Assert
        expect(result).toBe(
          "throw:TypeError:Cannot read properties of undefined (reading 'every')"
        )
        expect(result).toBe(await writeOutcomeOf(oracle, ordered, {}, options))
      }
    )
  })
})
