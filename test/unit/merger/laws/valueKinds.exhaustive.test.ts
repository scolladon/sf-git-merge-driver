import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../../src/types/jsonTypes.js'
import { mergeXml, parseXml } from './arbitraries.js'

// Every trio of values one tag can hold, merged through the whole pipeline
// (parse, merge, write). The oracle is written from what a merge must
// promise, not from how the merger tells value kinds apart: it only knows
// which side changed, and compares re-parsed documents.

interface Value {
  readonly name: string
  readonly kind: string
  readonly repeated: boolean
  readonly inner?: string
  readonly attributes?: string
  readonly family?: string
}

const leaf = (
  name: string,
  kind: string,
  inner: string,
  attributes = ''
): Value => ({ name, kind, repeated: false, inner, attributes })

// Child tags beside parts of one content key. The children merge key by key,
// so a trio mixing them with other shapes (a plain element, another content
// key) legitimately merges to a document no side held: this oracle only
// knows whole values, so these values are crossed with their own family.
const partsLeaf = (family: string, name: string, parts: string): Value => ({
  ...leaf(name, `ELEMENT_${family.toUpperCase()}_PARTS`, `<k>1</k>${parts}`),
  family,
})

const VALUES: readonly Value[] = [
  { name: 'absent', kind: 'ABSENT', repeated: false },
  leaf('empty', 'EMPTY', ''),
  leaf('text a', 'TEXT', 'a'),
  leaf('text b', 'TEXT', 'b'),
  leaf('comment 1', 'COMMENT', '<!--c1-->'),
  leaf('comment 2', 'COMMENT', '<!--c2-->'),
  leaf('cdata x', 'CDATA', '<![CDATA[x]]>'),
  leaf('cdata y', 'CDATA', '<![CDATA[y]]>'),
  leaf('element 1', 'ELEMENT', '<k>1</k>'),
  leaf('element 2', 'ELEMENT', '<k>2</k>'),
  leaf('attributed', 'ELEMENT', '<k>1</k>', ' at="1"'),
  leaf('attributed text', 'ATTRIBUTED_TEXT', 'a', ' at="1"'),
  leaf('attributed cdata', 'ATTRIBUTED_CDATA', '<![CDATA[x]]>', ' at="1"'),
  leaf('text and comment', 'TEXT_COMMENT', 'a<!--c1-->'),
  leaf('text and cdata', 'TEXT_CDATA', 'a<![CDATA[x]]>'),
  leaf('text, cdata and comment', 'TEXT_CONTENT', 'a<![CDATA[x]]><!--c1-->'),
  leaf('text and element', 'MIXED', 'a<k>1</k>'),
  leaf('text and other element', 'MIXED', 'a<k>2</k>'),
  leaf('text and other comment', 'TEXT_COMMENT', 'a<!--c2-->'),
  leaf('other text and comment', 'TEXT_COMMENT', 'b<!--c1-->'),
  leaf('text and other cdata', 'TEXT_CDATA', 'a<![CDATA[y]]>'),
  leaf('other text and cdata', 'TEXT_CDATA', 'b<![CDATA[x]]>'),
  leaf('cdata and comment', 'CONTENT', '<![CDATA[x]]><!--c1-->'),
  leaf('other cdata and comment', 'CONTENT', '<![CDATA[y]]><!--c1-->'),
  leaf('cdata and other comment', 'CONTENT', '<![CDATA[x]]><!--c2-->'),
  leaf('other text and element', 'MIXED', 'b<k>1</k>'),
  leaf('text over lines', 'TEXT', 'a\n\n   \nb'),
  leaf('cdata over lines', 'CDATA', '<![CDATA[x\n\n   \ny]]>'),
  leaf('split cdata escape', 'CDATA_PARTS', '<![CDATA[x]]]]><![CDATA[>y]]>'),
  leaf(
    'other split cdata escape',
    'CDATA_PARTS',
    '<![CDATA[x]]]]><![CDATA[>z]]>'
  ),
  leaf('two cdata', 'CDATA_PARTS', '<![CDATA[A]]><![CDATA[B]]>'),
  leaf(
    'two cdata, first differs',
    'CDATA_PARTS',
    '<![CDATA[A2]]><![CDATA[B]]>'
  ),
  leaf(
    'two cdata, second differs',
    'CDATA_PARTS',
    '<![CDATA[A]]><![CDATA[B2]]>'
  ),
  leaf('two comments', 'COMMENT_LIST', '<!--c1--><!--c2-->'),
  leaf('two comments, first differs', 'COMMENT_LIST', '<!--c9--><!--c2-->'),
  leaf('two comments, second differs', 'COMMENT_LIST', '<!--c1--><!--c8-->'),
  partsLeaf(
    'cdata',
    'element and split cdata escape',
    '<![CDATA[x]]]]><![CDATA[>y]]>'
  ),
  partsLeaf(
    'cdata',
    'element and split cdata, second differs',
    '<![CDATA[x]]]]><![CDATA[>z]]>'
  ),
  partsLeaf(
    'cdata',
    'element and split cdata, first differs',
    '<![CDATA[w]]]]><![CDATA[>y]]>'
  ),
  partsLeaf('comments', 'element and two comments', '<!--c1--><!--c2-->'),
  partsLeaf(
    'comments',
    'element and two comments, second differs',
    '<!--c1--><!--c3-->'
  ),
  partsLeaf(
    'comments',
    'element and two comments, first differs',
    '<!--c0--><!--c2-->'
  ),
  leaf('number', 'NUMBER', '1'),
  leaf('number with zero', 'NUMBER', '01'),
  leaf('non-breaking space', 'NBSP', '\u00a0'),
  {
    name: 'repeated',
    kind: 'REPEATED',
    repeated: true,
    inner: '<k>1</k>|<k>3</k>',
  },
]

const ROOT_UNSUPPORTED = [
  'absent',
  'attributed',
  'attributed text',
  'attributed cdata',
  'repeated',
]

const tagXml = (value: Value, tag: string): string => {
  if (value.kind === 'ABSENT') return ''
  if (value.repeated) {
    return (value.inner as string)
      .split('|')
      .map(inner => `<${tag}>${inner}</${tag}>`)
      .join('')
  }
  if (value.inner === '') return `<${tag}${value.attributes}/>`
  return `<${tag}${value.attributes}>${value.inner}</${tag}>`
}

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n'
const NAMESPACE = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
const EDITED_BY_OURS = 'true'
const UNTOUCHED = 'false'

// The value sits either under a tag next to a sibling that ours edits, or
// as the body of the root element itself
interface Placement {
  readonly label: string
  readonly values: readonly Value[]
  readonly document: (value: Value, custom: string) => string
  readonly entries: (xml: string) => string[]
  readonly expectsEdit: boolean
  // Kinds a family value may be crossed with: an emptied root keeps no child
  // tag to take back, unlike an emptied tag, which is one whole value
  readonly familyNeighbours: readonly string[]
}

const tagPlacement = (tag: string): Placement => ({
  label: `the tag <${tag}> inside a Profile`,
  values: VALUES,
  expectsEdit: true,
  familyNeighbours: ['ABSENT', 'EMPTY'],
  document: (value, custom) =>
    `${PROLOG}<Profile ${NAMESPACE}><custom>${custom}</custom>${tagXml(value, tag)}</Profile>\n`,
  entries: xml => {
    const root = parseXml(xml).content['Profile'] as Record<string, JsonValue>
    const held = root[tag]
    if (held === undefined) return []
    return (Array.isArray(held) ? held : [held]).map(canonical)
  },
})

const rootPlacement: Placement = {
  label: 'the body of the root element',
  values: VALUES.filter(value => !ROOT_UNSUPPORTED.includes(value.name)),
  expectsEdit: false,
  familyNeighbours: [],
  document: value =>
    value.inner === ''
      ? `${PROLOG}<Profile ${NAMESPACE}/>\n`
      : `${PROLOG}<Profile ${NAMESPACE}>${value.inner}</Profile>\n`,
  entries: xml => [canonical(parseXml(xml).content['Profile'])],
}

const MARKERS = /^(<{7} ours|\|{7} base|={7}|>{7} theirs)$/
type Choice = 'ours' | 'theirs'

const sectionAfter = (marker: string): string => {
  if (marker.startsWith('<')) return 'ours'
  if (marker.startsWith('|')) return 'base'
  return marker.startsWith('=') ? 'theirs' : 'outside'
}

const resolvedTo = (conflicted: string, choice: Choice): string => {
  let section = 'outside'
  const kept: string[] = []
  for (const line of conflicted.split('\n')) {
    if (MARKERS.test(line)) {
      section = sectionAfter(line)
      continue
    }
    if (section === 'outside' || section === choice) kept.push(line)
  }
  return kept.join('\n')
}

const canonical = (value: JsonValue | undefined): string =>
  JSON.stringify(value ?? null, (_, node) =>
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? Object.fromEntries(
          Object.entries(node).sort(([left], [right]) =>
            left < right ? -1 : 1
          )
        )
      : node
  )

const contentOf = (xml: string): string => canonical(parseXml(xml).content)

type Trio = readonly [Value, Value, Value]

interface Expected {
  readonly content: string
  readonly entries: string[]
}

const expectedOf = (value: Value, placement: Placement): Expected => {
  const xml = placement.document(value, EDITED_BY_OURS)
  return { content: contentOf(xml), entries: placement.entries(xml) }
}

const CORRUPTION = /\[native code\]|\[object |undefined|NaN/

const reasonOfCorruption = (output: string): string | undefined =>
  CORRUPTION.test(output)
    ? 'output carries a stringified runtime value'
    : undefined

const sidesOf = (
  output: string,
  hasConflict: boolean
): readonly { readonly label: string; readonly xml: string }[] =>
  hasConflict
    ? [
        { label: 'ours', xml: resolvedTo(output, 'ours') },
        { label: 'theirs', xml: resolvedTo(output, 'theirs') },
      ]
    : [{ label: 'merged', xml: output }]

type Outcome = { output: string; hasConflict: boolean }

const unheldEntry = (
  trio: Trio,
  placement: Placement,
  { output, hasConflict }: Outcome
): string | undefined => {
  const held = new Set(
    trio.flatMap(value => expectedOf(value, placement).entries)
  )
  for (const { label, xml } of sidesOf(output, hasConflict)) {
    for (const entry of placement.entries(xml)) {
      if (!held.has(entry)) return `${label} keeps ${entry}, no side held it`
    }
  }
  return undefined
}

const resolutionMismatch = (
  [, local, other]: Trio,
  placement: Placement,
  output: string
): string | undefined => {
  const sides: readonly [Choice, Value][] = [
    ['ours', local],
    ['theirs', other],
  ]
  for (const [choice, value] of sides) {
    const resolved = contentOf(resolvedTo(output, choice))
    if (resolved !== expectedOf(value, placement).content) {
      return `resolving to ${choice} is not ${choice}`
    }
  }
  return undefined
}

const verdictOfNonRepeated = (
  trio: Trio,
  placement: Placement,
  result: Outcome
): string | undefined => {
  const [ancestor, local, other] = trio
  const ours = local !== ancestor
  const theirs = other !== ancestor
  if (ours && theirs && local !== other) {
    return result.hasConflict
      ? resolutionMismatch(trio, placement, result.output)
      : 'both sides changed apart, no conflict'
  }
  if (result.hasConflict) return 'conflict where the changes do not overlap'
  const winner = ours ? local : other
  return contentOf(result.output) === expectedOf(winner, placement).content
    ? undefined
    : `merged document is not the one holding the change (${winner.name})`
}

const verdictOfRepeated = (
  trio: Trio,
  placement: Placement,
  result: Outcome
): string | undefined => {
  const [ancestor, local, other] = trio
  if (local === ancestor && other === ancestor) {
    return contentOf(result.output) ===
      expectedOf(ancestor, placement).content && !result.hasConflict
      ? undefined
      : 'unchanged sides do not give the ancestor'
  }
  return result.hasConflict
    ? resolutionMismatch(trio, placement, result.output)
    : undefined
}

const verdictOf = async (
  trio: Trio,
  placement: Placement
): Promise<string | undefined> => {
  const documents = trio.map((value, side) =>
    placement.document(value, side === 1 ? EDITED_BY_OURS : UNTOUCHED)
  ) as [string, string, string]
  const result = await mergeXml(documents)
  const verdictOfShape = trio.some(value => value.repeated)
    ? verdictOfRepeated
    : verdictOfNonRepeated
  return (
    reasonOfCorruption(result.output) ??
    unheldEntry(trio, placement, result) ??
    verdictOfShape(trio, placement, result)
  )
}

const guarded = async (
  trio: Trio,
  placement: Placement
): Promise<string | undefined> => {
  try {
    return await verdictOf(trio, placement)
  } catch (error) {
    return `threw ${(error as Error).message}`
  }
}

const isCrossable = (
  trio: Trio,
  wholeValueKinds: readonly string[]
): boolean => {
  const families = new Set(trio.flatMap(value => value.family ?? []))
  if (families.size === 0) return true
  return (
    families.size === 1 &&
    trio.every(
      value =>
        value.family !== undefined || wholeValueKinds.includes(value.kind)
    )
  )
}

const triosOf = (placement: Placement): Trio[] =>
  placement.values
    .flatMap(a =>
      placement.values.flatMap(l =>
        placement.values.map(o => [a, l, o] as Trio)
      )
    )
    .filter(trio => isCrossable(trio, placement.familyNeighbours))

const pairOf = (trio: Trio): string =>
  [...new Set(trio.map(value => value.kind))].sort().join('+')

const failuresOf = async (
  placement: Placement
): Promise<Record<string, string>> => {
  const failures: Record<string, string[]> = {}
  for (const trio of triosOf(placement)) {
    const verdict = await guarded(trio, placement)
    if (verdict === undefined) continue
    const names = trio.map(value => value.name).join(' | ')
    const list = failures[pairOf(trio)] ?? []
    failures[pairOf(trio)] = [...list, `${names}: ${verdict}`]
  }
  return Object.fromEntries(
    Object.entries(failures).map(([pair, list]) => [
      pair,
      `${list.length} failing, e.g. ${list[0]}`,
    ])
  )
}

const EXHAUSTIVE_TIMEOUT_MS = 60_000

const PLACEMENTS = [
  tagPlacement('t'),
  tagPlacement('description'),
  rootPlacement,
]

describe('every trio of values at one place', () => {
  describe.each(PLACEMENTS)('given $label', placement => {
    it(
      'when merged through the pipeline then each trio keeps what a side held',
      async () => {
        // Act
        const sut = await failuresOf(placement)

        // Assert
        expect(sut).toEqual({})
      },
      EXHAUSTIVE_TIMEOUT_MS
    )
  })
})
