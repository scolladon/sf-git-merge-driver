import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'
import {
  assertLaw,
  contestedSidesArb,
  dupSidesArb,
  entriesOf,
  KEYS,
  type KindSpec,
  mergeFile,
  mergeXml,
  namedTypes,
  namedTypesWithoutSibling,
  orderedTypes,
  parseXml,
  ROOT_ATTRIBUTES,
  replacementArb,
  type Side,
  sidesArb,
  text,
  unorderedTypes,
  xmlOf,
} from './arbitraries.js'

type Sides = readonly [Side, Side, Side]

const everyType: readonly KindSpec[] = [
  ...unorderedTypes,
  ...orderedTypes,
  text,
]

// ---- the root keeps its namespaces and attributes

const ATTRIBUTE_POOL: JsonObject = {
  '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  '@_xsi:schemaLocation': 'urn:a urn:b',
  '@_xmlns:other': 'urn:other',
}

interface RootAttributes {
  readonly ancestor: JsonObject
  readonly local: JsonObject
  readonly other: JsonObject
  readonly expected: JsonObject
}

const pick = (names: readonly string[]): JsonObject =>
  Object.fromEntries(names.map(name => [name, ATTRIBUTE_POOL[name]]))

const poolNames = Object.keys(ATTRIBUTE_POOL)

// Each side may add attributes on top of the ancestor's; the namespace stays
const rootAttributesArb: fc.Arbitrary<RootAttributes> = fc
  .tuple(fc.subarray(poolNames), fc.subarray(poolNames), fc.subarray(poolNames))
  .map(([shared, addedLocal, addedOther]) => {
    const [ancestor, local, other] = [
      shared,
      [...shared, ...addedLocal],
      [...shared, ...addedOther],
    ].map(names => ({ ...ROOT_ATTRIBUTES, ...pick(names) }))
    return { ancestor, local, other, expected: { ...local, ...other } }
  })

const rootIsKept = (spec: KindSpec) =>
  fc.asyncProperty(
    sidesArb(spec),
    rootAttributesArb,
    async ([a, l, o], attributes) => {
      // Arrange
      const files = [
        await xmlOf(spec, a, attributes.ancestor),
        await xmlOf(spec, l, attributes.local),
        await xmlOf(spec, o, attributes.other),
      ] as const
      const sut = await mergeXml(files)
      fc.pre(!sut.hasConflict)

      // Act
      const merged = parseXml(sut.output)

      // Assert
      expect(Object.keys(merged.content)).toEqual([spec.root])
      expect(merged.rootAttributes).toEqual(attributes.expected)
    }
  )

// ---- a conflicted file resolves to a parseable file

const MARKER = /^(<{7} ours|\|{7} base|={7}|>{7} theirs)$/
const MARKER_ANYWHERE = /<{7} ours|\|{7} base|={7}|>{7} theirs/g

type Choice = 'ours' | 'theirs'

const OPENING = '<<<<<<< ours'
const BASE = '||||||| base'
const SEPARATING = '======='
const CLOSING = '>>>>>>> theirs'

const sectionAfter = (line: string, section: string): string => {
  if (line === OPENING) return 'ours'
  if (line === BASE) return 'base'
  if (line === SEPARATING) return 'theirs'
  return line === CLOSING ? 'outside' : section
}

const resolvedTo = (conflicted: string, choice: Choice): string => {
  let section = 'outside'
  const kept: string[] = []
  for (const line of conflicted.split('\n')) {
    const next = sectionAfter(line, section)
    if (next === section && (section === 'outside' || section === choice)) {
      kept.push(line)
    }
    section = next
  }
  return kept.join('\n')
}

const markersSitOnTheirOwnLines = (conflicted: string): boolean =>
  conflicted.split('\n').filter(line => MARKER.test(line)).length ===
  (conflicted.match(MARKER_ANYWHERE) ?? []).length

// A field is text, an empty element or an element of its own, never a list of
// repeated ones
const isOneElementPerEntry = (entry: JsonValue): boolean =>
  typeof entry !== 'object' ||
  entry === null ||
  Object.values(entry).every(
    field => !Array.isArray(field) && isOneElementPerEntry(field)
  )

// ---- no identity the sides did not already carry

const countsByKey = (spec: KindSpec, side: Side): Map<string, number> =>
  side.reduce(
    (counts, entry) =>
      counts.set(spec.keyOf(entry), (counts.get(spec.keyOf(entry)) ?? 0) + 1),
    new Map<string, number>()
  )

const exceedsSides = (
  spec: KindSpec,
  [, local, other]: Sides,
  merged: Side
) => {
  const [inLocal, inOther] = [local, other].map(side => countsByKey(spec, side))
  return KEYS.filter(
    key =>
      (countsByKey(spec, merged).get(key) ?? 0) >
      Math.max(inLocal.get(key) ?? 0, inOther.get(key) ?? 0)
  )
}

const noNewDuplicate = (spec: KindSpec) =>
  fc.asyncProperty(fc.oneof(sidesArb(spec), dupSidesArb(spec)), async sides => {
    // Arrange
    const sut = await mergeFile(spec, sides)
    fc.pre(!sut.hasConflict)

    // Act
    const excess = exceedsSides(spec, sides, entriesOf(spec, sut.output))

    // Assert
    expect(excess).toEqual([])
  })

const conflictResolves = (spec: KindSpec) =>
  fc.asyncProperty(contestedSidesArb(spec), async sides => {
    // Arrange
    const sut = await mergeFile(spec, sides)
    fc.pre(sut.hasConflict)
    const resolved = (['ours', 'theirs'] as const).map(choice =>
      resolvedTo(sut.output, choice)
    )

    // Act
    const files = resolved.map(parseXml)
    const entries = resolved.map(xml => entriesOf(spec, xml))

    // Assert
    expect(markersSitOnTheirOwnLines(sut.output)).toBe(true)
    expect(files.map(file => Object.keys(file.content))).toEqual([
      [spec.root],
      [spec.root],
    ])
    expect(files.map(file => file.rootAttributes)).toEqual([
      ROOT_ATTRIBUTES,
      ROOT_ATTRIBUTES,
    ])
    expect(
      entries.flat().filter(entry => !isOneElementPerEntry(entry))
    ).toEqual([])
    expect(entries.flatMap(side => exceedsSides(spec, sides, side))).toEqual([])
  })

// A side that deletes the whole file contests the root itself: the block
// holds the entries, and the side the file survives on must stay deployable
const DELETED_FILE = ''

const wholeFileConflictResolves = (spec: KindSpec) =>
  fc.asyncProperty(
    replacementArb(spec).filter(({ a }) => a.length > 1),
    fc.boolean(),
    async ({ a, index, modified }, deletedByOther) => {
      // Arrange
      const edited = a.map((entry, j) => (j === index ? modified : entry))
      const [base, kept] = [await xmlOf(spec, a), await xmlOf(spec, edited)]
      const sut = await mergeXml(
        deletedByOther ? [base, kept, DELETED_FILE] : [base, DELETED_FILE, kept]
      )

      // Act
      const [survivor, deleter] = (
        deletedByOther
          ? (['ours', 'theirs'] as const)
          : (['theirs', 'ours'] as const)
      ).map(choice => parseXml(resolvedTo(sut.output, choice)))
      const entries = entriesOf(
        spec,
        resolvedTo(sut.output, deletedByOther ? 'ours' : 'theirs')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(Object.keys(survivor.content)).toEqual([spec.root])
      expect(survivor.rootAttributes).toEqual(ROOT_ATTRIBUTES)
      expect(entries).toHaveLength(edited.length)
      expect(entries.filter(entry => !isOneElementPerEntry(entry))).toEqual([])
      expect(deleter.content).toEqual({})
    }
  )

// ---- element order

// Each type lists its children in the order a retrieve writes them
const CHILD_ORDERS: readonly (readonly [string, readonly string[]])[] = [
  ['Profile', ['custom', 'description', 'fieldPermissions', 'userLicense']],
  [
    'PermissionSet',
    ['description', 'hasActivationRequired', 'label', 'objectPermissions'],
  ],
  ['GlobalValueSet', ['customValue', 'description', 'masterLabel', 'sorted']],
  ['StandardValueSet', ['groupingStringEnum', 'sorted', 'standardValue']],
]

const CHILD_TEXT = 'v'

const childrenXml = (
  root: string,
  children: readonly string[]
): Promise<string> =>
  serializeToString(
    new XmlStreamWriter(defaultConfig),
    [{ [root]: Object.fromEntries(children.map(c => [c, CHILD_TEXT])) }],
    ROOT_ATTRIBUTES
  )

const childrenOf = (root: string, xml: string): string[] => {
  const body = parseXml(xml).content[root]
  return typeof body === 'object' && body !== null ? Object.keys(body) : []
}

const childOrderIsKept = (root: string, order: readonly string[]) =>
  fc.asyncProperty(
    fc.tuple(
      fc.subarray([...order]),
      fc.subarray([...order]),
      fc.subarray([...order])
    ),
    async ([a, l, o]) => {
      // Arrange
      const sut = await mergeXml([
        await childrenXml(root, a),
        await childrenXml(root, l),
        await childrenXml(root, o),
      ])
      fc.pre(!sut.hasConflict)

      // Act
      const merged = childrenOf(root, sut.output)

      // Assert
      expect(merged).toEqual(order.filter(child => merged.includes(child)))
    }
  )

// A reorder a side made on purpose is not a scramble: the sides here write
// each entry's fields in one order
const fieldOrderIsKept = (spec: KindSpec) =>
  fc.asyncProperty(sidesArb({ ...spec, reorderWeight: 0 }), async sides => {
    // Arrange
    const sut = await mergeFile(spec, sides)
    fc.pre(!sut.hasConflict)
    const canonical = Object.keys((sides.flat()[0] ?? {}) as JsonObject)

    // Act
    const written = entriesOf(spec, sut.output).map(entry =>
      Object.keys(entry as JsonObject)
    )

    // Assert
    expect(
      written.filter(fields => fields.join() !== canonical.join())
    ).toEqual([])
  })

describe('JsonMerger laws: file deployability', () => {
  describe.each(namedTypes(everyType))('given %s sides', (_name, spec) => {
    it('when the merge is clean then the output parses with the same root and keeps the root attributes', async () => {
      await assertLaw(rootIsKept(spec))
    })
  })

  describe.each(namedTypes([...unorderedTypes, ...orderedTypes]))(
    'given %s sides',
    (_name, spec) => {
      it('when one side deletes the file and the other edits an entry then the side the file survives on is a deployable file', async () => {
        await assertLaw(wholeFileConflictResolves(spec))
      })
    }
  )

  describe.each(namedTypesWithoutSibling(everyType))(
    'given %s sides',
    (_name, spec) => {
      it('when the merge conflicts then each side the blocks resolve to is a deployable file and the markers sit on their own lines', async () => {
        await assertLaw(conflictResolves(spec))
      })
    }
  )

  describe.each(namedTypes(everyType))('given %s sides', (_name, spec) => {
    it('when the merge is clean then no identity appears more often than in the busier live side', async () => {
      await assertLaw(noNewDuplicate(spec))
    })
  })

  describe.each(CHILD_ORDERS)('given %s sides', (root, order) => {
    it('when the merge is clean then the children come out in the order the sides share', async () => {
      await assertLaw(childOrderIsKept(root, order))
    })
  })

  describe.each(namedTypes([...unorderedTypes, ...orderedTypes]))(
    'given %s sides',
    (_name, spec) => {
      it('when the merge is clean then the fields of every entry keep their order', async () => {
        await assertLaw(fieldOrderIsKept(spec))
      })
    }
  )
})
