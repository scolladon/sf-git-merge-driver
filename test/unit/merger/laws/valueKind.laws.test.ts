import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'
import { assertLaw, mergeXml, parseXml } from './arbitraries.js'

// A tag that may repeat holds text, empty elements or elements, and the three
// sides differ in which: one tag as an array of items on one side, a single
// element on another and text on the third. Whatever the merge keeps, a
// conflict side included, is an item one side held. An item that no side held
// is two entries fused into one element, or text read as an element.

type Item = string | Readonly<Record<string, string>>

interface Kind {
  readonly tag: string
  readonly items: fc.Arbitrary<Item>
}

const TEXTS = fc.constantFrom('text', 'more')

const keyedKind: Kind = {
  tag: 'fieldPermissions',
  items: fc.oneof(
    TEXTS,
    fc.record({
      field: fc.constantFrom('A.b', 'A.c'),
      editable: fc.constantFrom('true', 'false'),
    })
  ),
}

const unkeyedKind: Kind = {
  tag: 'foo',
  items: fc.oneof(TEXTS, fc.record({ a: fc.constantFrom('1', '2', '3') })),
}

const MAX_ITEMS = 3

const sideArb = (kind: Kind) => fc.array(kind.items, { maxLength: MAX_ITEMS })

const trioArb = (kind: Kind) =>
  fc.tuple(sideArb(kind), sideArb(kind), sideArb(kind))

const itemXml = (tag: string, item: Item): string =>
  typeof item === 'string'
    ? `<${tag}>${item}</${tag}>`
    : `<${tag}>${Object.entries(item)
        .map(([name, value]) => `<${name}>${value}</${name}>`)
        .join('')}</${tag}>`

const documentOf = (kind: Kind, side: readonly Item[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata"><custom>false</custom>${side
    .map(item => itemXml(kind.tag, item))
    .join('')}</Profile>\n`

const MARKERS = /^(<{7} ours|\|{7} base|={7}|>{7} theirs)$/
type Choice = 'ours' | 'theirs'

const resolvedTo = (conflicted: string, choice: Choice): string => {
  let section = 'outside'
  const kept: string[] = []
  for (const line of conflicted.split('\n')) {
    if (MARKERS.test(line)) {
      section = nextSection(line)
      continue
    }
    if (section === 'outside' || section === choice) kept.push(line)
  }
  return kept.join('\n')
}

const nextSection = (marker: string): string => {
  if (marker.startsWith('<')) return 'ours'
  if (marker.startsWith('|')) return 'base'
  return marker.startsWith('=') ? 'theirs' : 'outside'
}

const canonical = (value: JsonValue): string =>
  JSON.stringify(value, (_, node) =>
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? Object.fromEntries(
          Object.entries(node).sort(([left], [right]) =>
            left < right ? -1 : 1
          )
        )
      : node
  )

const itemsOf = (kind: Kind, xml: string): string[] => {
  const root = parseXml(xml).content['Profile'] as JsonObject
  const value = root[kind.tag]
  if (value === undefined) return []
  return (Array.isArray(value) ? value : [value]).map(canonical)
}

const keepsOnlyItemsASideHeld = (kind: Kind) =>
  fc.asyncProperty(trioArb(kind), async trio => {
    // Arrange
    const documents = trio.map(side => documentOf(kind, side)) as [
      string,
      string,
      string,
    ]
    const held = new Set(documents.flatMap(xml => itemsOf(kind, xml)))

    // Act
    const sut = await mergeXml(documents)

    // Assert
    const resolutions = sut.hasConflict
      ? (['ours', 'theirs'] as const).map(choice =>
          resolvedTo(sut.output, choice)
        )
      : [sut.output]
    for (const resolved of resolutions) {
      for (const item of itemsOf(kind, resolved)) {
        expect(held).toContain(item)
      }
    }
  })

describe('merge laws: a value that changes kind', () => {
  describe.each([
    ['a keyed tag', keyedKind],
    ['an unkeyed tag', unkeyedKind],
  ])('given %s repeated, single, text or absent on each side', (_, kind) => {
    it('when merged then every kept item, conflict sides included, is one a side held', async () => {
      await assertLaw(keepsOnlyItemsASideHeld(kind))
    })
  })
})
