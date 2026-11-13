import fc from 'fast-check'
import { PARSER_BEHAVIOUR_CHANGES } from './parserBehaviourChanges.js'
import { listParityInputs, type ParityParser } from './parserParity.js'

const UNDEFINED_TAG = 'U'
const ARRAY_TAG = 'A'
const OBJECT_TAG = 'O'

// Larger fixtures add parse time to every property run without adding a
// shape the small ones lack
const SEED_SIZE_LIMIT = 4_000

// Few edits keep the document close enough to its seed to stay mostly
// parseable, so both the success and the failure paths are reached
const MAX_EDITS = 3

// A delete removes one to three chars: enough to cut a token in half
const DELETE_SPANS = 3

const EDIT_KINDS = ['insert', 'delete', 'replace', 'truncate', 'move'] as const
type EditKind = (typeof EDIT_KINDS)[number]

// The chars and tokens that open, close or break a markup construct
const EDIT_TOKENS: readonly string[] = [
  '<',
  '>',
  '/',
  '=',
  '"',
  "'",
  ' ',
  '\n',
  '\t',
  '!',
  '-',
  '?',
  '[',
  ']',
  '&',
  ';',
  ':',
  '_',
  '@',
  '#',
  'a',
  'b',
  'X',
  'Y',
  '</',
  '/>',
  '<!--',
  '-->',
  '<![CDATA[',
  ']]>',
  '<?',
  '?>',
  'b>',
  '</b>',
  ' x="1"',
]

// Shapes at the edges of the scanner's leaf, tag, close and child-store paths
const HAND_SHAPES: readonly string[] = [
  '<a><b>x</b></a>',
  '<a><b></b></a>',
  '<a><b> x </b></a>',
  '<a><b>x</b ></a>',
  '<a><b>x</bb></a>',
  '<a><b>x</ b></a>',
  '<a><b>x</c></a>',
  '<a><b>x</b',
  '<a><b>x</',
  '<a><b>x<',
  '<a><b>x',
  '<a><b>',
  '<a><b',
  '<a>x</a>',
  '<a></a>',
  '<a/>',
  '<a><b/></a>',
  '<a><b /></a>',
  `<a><b'>x</b'></a>`,
  `<a><b">x</b"></a>`,
  `<a><b'>x</b></a>`,
  `<a><b>x</b'></a>`,
  '<a><b>x</b>y</a>',
  '<a>y<b>x</b></a>',
  '<a><b>x</b><b>y</b></a>',
  '<a><b>x</b><c>1</c><b>y</b><b>z</b></a>',
  '<a><b><c>1</c></b><b>y</b></a>',
  '<a><b>y</b><b><c>1</c></b></a>',
  '<a><b><b>x</b></b></a>',
  '<a><__proto__>x</__proto__></a>',
  '<a><__proto__>x</__proto__><__proto__>y</__proto__></a>',
  '<a><constructor>x</constructor><toString>y</toString></a>',
  '<a><__cdata>x</__cdata><![CDATA[y]]></a>',
  '<a><![CDATA[y]]><__cdata>x</__cdata></a>',
  '<a><![CDATA[y]]><![CDATA[z]]></a>',
  '<a><!--c--><b>1</b><!--d--></a>',
  '<a x="1"><b y="2">t</b><b y="3"/><b>u</b></a>',
  '<a><b x="1"></b></a>',
  '<a><b x="1"><c>2</c></b></a>',
  '<a><b x="1"><c>2</c>t</b></a>',
  '<a><b\n>x</b></a>',
  '<a><b >x</b></a>',
  '<a><b\t>x</b\t></a>',
  '<a><b>x</b>\n</a>\n',
  '<a><b>x\n</b></a>',
  '<a><b>\n  x\n  y\n</b></a>',
  '<a><b>x</b></a><c>y</c>',
  '<a><b>x</b></a></b>',
  '<a><b>x</b></a>trailing',
  '<a><b>&lt;</b><c>1 < 2</c></a>',
  '<a><b>x</b</a>',
  '<a><b>x</b/></a>',
  '<a><:b>x</:b><_c>y</_c><é>z</é></a>',
  '<a><1>x</1></a>',
  '<a><b>x</b><></a>',
  '<a><b> x </b></a>',
  '﻿<a><b>x</b></a>',
  '<?xml version="1.0"?>\n<a xmlns="u"><b>x</b></a>\n',
  '<a><b>x</b><?pi?></a>',
  '<a><b>x</b><!DOCTYPE z></a>',
  '<a><b><![CDATA[x]]></b></a>',
  '<a><values><field>F</field><value xsi:type="xsd:string">v</value></values><values><field>G</field><value xsi:nil="true"/></values></a>',
]

interface EditSite {
  readonly xml: string
  readonly at: number
  readonly to: number
  readonly token: string
}

interface XmlEdit {
  readonly kind: EditKind
  readonly at: number
  readonly to: number
  readonly token: string
}

const prototypeTagOf = (value: object): string => {
  const prototype = Object.getPrototypeOf(value)
  if (prototype === null) return 'null'
  return prototype === Object.prototype ? 'Object' : 'other'
}

const objectCanonOf = (value: object): unknown[] => {
  const record = value as Record<string, unknown>
  const head: unknown[] = [OBJECT_TAG, prototypeTagOf(value)]
  return head.concat(
    Object.keys(record).map(key => [key, canonOf(record[key])])
  )
}

// Key order, array-ness, undefined and the prototype of every object all
// reach the pipeline, so all of them are part of the outcome
const canonOf = (value: unknown): unknown => {
  if (value === undefined) return [UNDEFINED_TAG]
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const head: unknown[] = [ARRAY_TAG]
    return head.concat(value.map(canonOf))
  }
  return objectCanonOf(value)
}

const errorTextOf = (error: unknown): string =>
  error instanceof Error
    ? `${error.constructor.name}:${error.message}`
    : String(error)

// The outcome of a parse as the pipeline observes it: key order, array-ness,
// undefined and the prototype of every object, or the class and message of
// the error
export const parseOutcomeOf = (parser: ParityParser, xml: string): string => {
  try {
    return `ok:${JSON.stringify(canonOf(parser.parseString(xml)))}`
  } catch (error) {
    return `throw:${errorTextOf(error)}`
  }
}

// The lexed tag with the prototype of its attribute bag
export const lexOutcomeOf = (
  lex: (xml: string, pos: number) => unknown,
  tag: string
): string => JSON.stringify(canonOf(lex(tag, 0)))

const moveSpan = ({ xml, at, to }: EditSite): string => {
  const start = Math.min(at, to)
  const end = Math.max(at, to)
  return xml.slice(0, start) + xml.slice(end) + xml.slice(start, end)
}

const EDITS: Readonly<Record<EditKind, (site: EditSite) => string>> = {
  insert: ({ xml, at, token }) => xml.slice(0, at) + token + xml.slice(at),
  delete: ({ xml, at, to }) =>
    xml.slice(0, at) + xml.slice(at + 1 + (to % DELETE_SPANS)),
  replace: ({ xml, at, token }) => xml.slice(0, at) + token + xml.slice(at + 1),
  truncate: ({ xml, at }) => xml.slice(0, at),
  move: moveSpan,
}

const applyEdit = (xml: string, edit: XmlEdit): string => {
  const positions = xml.length + 1
  return EDITS[edit.kind]({
    xml,
    at: edit.at % positions,
    to: edit.to % positions,
    token: edit.token,
  })
}

const editArb: fc.Arbitrary<XmlEdit> = fc.record({
  kind: fc.constantFrom(...EDIT_KINDS),
  at: fc.nat(),
  to: fc.nat(),
  token: fc.constantFrom(...EDIT_TOKENS),
})

// Byte edits of a seed document: insert, delete, replace, truncate, move
export const xmlEditArb = (seeds: readonly string[]): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.nat({ max: seeds.length - 1 }),
      fc.array(editArb, { minLength: 1, maxLength: MAX_EDITS })
    )
    .map(([index, edits]) => edits.reduce(applyEdit, seeds[index]))

const xmlOfRow = ([, xml]: readonly [string, string]): string => xml

// The seed documents: every parity edge row, every behaviour-change row,
// every fixture under 4 000 chars and the hand shapes
export const parseSeeds = (): readonly string[] => {
  const { files, edges } = listParityInputs()
  const behaviourChanges = Object.values(PARSER_BEHAVIOUR_CHANGES).map(
    row => row.xml
  )
  const smallFiles = files
    .map(xmlOfRow)
    .filter(xml => xml.length < SEED_SIZE_LIMIT)
  return edges.map(xmlOfRow).concat(behaviourChanges, smallFiles, HAND_SHAPES)
}
