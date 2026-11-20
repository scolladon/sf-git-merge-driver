import fc from 'fast-check'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { NormalisedParseResult } from '../../../../src/adapter/XmlParser.js'
import { JsonMerger } from '../../../../src/merger/JsonMerger.js'
import { XmlMerger } from '../../../../src/merger/XmlMerger.js'
import {
  type ConflictBlock,
  isConflictBlock,
} from '../../../../src/types/conflictBlock.js'
import {
  createEmptyBody,
  type JsonArray,
  type JsonObject,
  type JsonValue,
} from '../../../../src/types/jsonTypes.js'
import { jsonIdentical } from '../../../../src/utils/jsonEqual.js'
import { mergeXmlStrings } from '../../../utils/mergeXmlStrings.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'
import { referenceOrder } from './childTagReference.js'

type Emission = 'sorted' | 'positional'
export type Side = readonly JsonValue[]

export interface KindSpec {
  readonly root: string
  readonly attribute: string
  readonly sibling: JsonObject
  readonly entry: (key: string) => fc.Arbitrary<JsonValue>
  readonly keyOf: (entry: JsonValue) => string
  readonly emission: Emission
  readonly toAttribute?: (side: Side) => JsonValue | undefined
  readonly fromAttribute?: (value: JsonValue) => Side
  readonly relabel: (entry: JsonValue, to: string) => JsonValue
  readonly keyProperty?: string
  // Where the properties of a plain-object kind stand: in the attribute's
  // object (a nested element) or straight in the root element
  readonly tagsOn?: 'root'
  // How often an edit only reorders an entry's child tags; 0 keeps every
  // entry's tags in the order its generator wrote them
  readonly reorderWeight?: number
}

export interface MergeOutcome {
  readonly output: JsonArray
  readonly hasConflict: boolean
}

export const KEYS = ['A', 'B', 'C', 'D', 'E']
const BOOLEAN_TEXT = fc.constantFrom('true', 'false')
// Three values, so local and other can edit one field to different values:
// the symmetry law then covers conflicting edits a two-value alphabet never
// produces
const PLAIN_FIELD_TEXT = fc.constantFrom('true', 'false', 'unset')
const PLAIN_LABEL_TEXT = fc.constantFrom('x', 'y', 'z')
const PLAIN_WEIGHT = 14
const SHAPE_WEIGHT = 1

// A value is text, an empty element (`<field/>`) or an element of its own: two
// sides may then hold the same field as text and as an element, the change of
// kind a merge must treat as a change of the whole value
const shapedValue = (text: fc.Arbitrary<string>): fc.Arbitrary<JsonValue> =>
  fc.oneof(
    { weight: PLAIN_WEIGHT, arbitrary: text },
    { weight: SHAPE_WEIGHT, arbitrary: fc.constant('') },
    {
      weight: SHAPE_WEIGHT,
      arbitrary: text.map(inner => ({ inner }) as JsonObject),
    }
  )

const FIELD_TEXT = shapedValue(PLAIN_FIELD_TEXT)
const LABEL_TEXT = shapedValue(PLAIN_LABEL_TEXT)
const KEEP_WEIGHT = 3
const DROP_WEIGHT = 1
const MODIFY_WEIGHT = 1
const REORDER_WEIGHT = 1

const fieldOf = (entry: JsonValue, field: string): string =>
  String((entry as JsonObject)[field])

export const keyed: KindSpec = {
  root: 'Profile',
  attribute: 'fieldPermissions',
  sibling: { custom: 'false' },
  entry: key =>
    fc.record({
      editable: FIELD_TEXT,
      field: fc.constant(key),
      readable: FIELD_TEXT,
    }),
  keyOf: entry => fieldOf(entry, 'field'),
  emission: 'sorted',
  relabel: (entry, to) => ({ ...(entry as JsonObject), field: to }),
  keyProperty: 'field',
}

export const ordered: KindSpec = {
  root: 'GlobalValueSet',
  attribute: 'customValue',
  sibling: { masterLabel: 'M' },
  entry: key =>
    fc.record({
      fullName: fc.constant(key),
      default: BOOLEAN_TEXT,
      label: LABEL_TEXT,
    }),
  keyOf: entry => fieldOf(entry, 'fullName'),
  emission: 'positional',
  relabel: (entry, to) => ({ ...(entry as JsonObject), fullName: to }),
  keyProperty: 'fullName',
}

export const text: KindSpec = {
  root: 'Package',
  attribute: 'members',
  sibling: { version: '60.0' },
  entry: key => fc.constant(key.toLowerCase()),
  keyOf: entry => String(entry).toUpperCase(),
  emission: 'sorted',
  relabel: (_entry, to) => to.toLowerCase(),
}

export const isPlainObject = (
  value: JsonValue | undefined
): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Pure object without key extractor: each entry is one property of the
// attribute's object
export const property: KindSpec = {
  root: 'CustomObject',
  attribute: 'nameField',
  sibling: { label: 'Obj' },
  entry: key => FIELD_TEXT.map(value => ({ [key]: value })),
  keyOf: entry => Object.keys(entry as JsonObject)[0],
  emission: 'sorted',
  toAttribute: side =>
    side.length === 0
      ? undefined
      : side.reduce<JsonObject>(
          (merged, entry) => ({ ...merged, ...(entry as JsonObject) }),
          {}
        ),
  fromAttribute: value =>
    isPlainObject(value)
      ? Object.entries(value).map(([name, text]) => ({ [name]: text }))
      : [],
  relabel: (entry, to) => ({ [to]: Object.values(entry as JsonObject)[0] }),
}

// The same properties as the nested kind, written as the root element's own
// children: the level where contested tags settle in canonical order
export const rootProperty: KindSpec = { ...property, tagsOn: 'root' }

export const isRootLevel = (spec: KindSpec): boolean => spec.tagsOn === 'root'

// Identified by what they are, so a variant of a kind (without its sibling)
// still counts as that kind
export const isText = (spec: KindSpec): boolean =>
  spec.root === text.root && spec.attribute === text.attribute

export const isProperty = (spec: KindSpec): boolean =>
  spec.root === property.root && spec.attribute === property.attribute

export const sideArb = (spec: KindSpec): fc.Arbitrary<Side> =>
  fc.shuffledSubarray(KEYS).chain(keys => fc.tuple(...keys.map(spec.entry)))

// The same content with its child tags in another order: the edit a keyed
// entry takes when a side only reorders it
const reorderedArb = (entry: JsonValue): fc.Arbitrary<JsonValue> => {
  if (!isPlainObject(entry)) return fc.constant(entry)
  const tags = Object.keys(entry)
  return fc
    .shuffledSubarray(tags, { minLength: tags.length, maxLength: tags.length })
    .map(order => Object.fromEntries(order.map(tag => [tag, entry[tag]])))
}

// A reorder that is a change: the child tags stand in another order
export const reorderedEntryArb = (entry: JsonValue): fc.Arbitrary<JsonValue> =>
  reorderedArb(entry).filter(reordered => !jsonIdentical(reordered, entry))

export const decisionArb = (
  spec: KindSpec,
  entry: JsonValue
): fc.Arbitrary<Side> =>
  fc.oneof(
    { weight: KEEP_WEIGHT, arbitrary: fc.constant([entry]) },
    { weight: DROP_WEIGHT, arbitrary: fc.constant([]) },
    {
      weight: MODIFY_WEIGHT,
      arbitrary: spec.entry(spec.keyOf(entry)).map(modified => [modified]),
    },
    {
      weight: spec.reorderWeight ?? REORDER_WEIGHT,
      arbitrary: reorderedArb(entry).map(reordered => [reordered]),
    }
  )

const insertAt = (
  side: Side,
  insertions: readonly { entry: JsonValue; position: number }[]
): Side =>
  insertions.reduce(
    (acc, { entry, position }) => {
      const index = position % (acc.length + 1)
      return [...acc.slice(0, index), entry, ...acc.slice(index)]
    },
    [...side]
  )

const insertionsArb = (spec: KindSpec, kept: Side): fc.Arbitrary<Side> => {
  const present = new Set(kept.map(spec.keyOf))
  const unused = KEYS.filter(key => !present.has(key))
  return fc.subarray(unused).chain(keys =>
    fc
      .tuple(
        fc.tuple(...keys.map(spec.entry)),
        fc.array(fc.nat(), {
          minLength: keys.length,
          maxLength: keys.length,
        })
      )
      .map(([entries, positions]) =>
        insertAt(
          kept,
          entries.map((entry, i) => ({ entry, position: positions[i] }))
        )
      )
  )
}

export const moveToEnd = (side: Side, index: number): Side =>
  side.length === 0
    ? side
    : [
        ...side.filter((_, i) => i !== index % side.length),
        side[index % side.length],
      ]

const permuteArb = (side: Side): fc.Arbitrary<Side> =>
  fc
    .tuple(fc.boolean(), fc.nat())
    .map(([shouldMove, index]) => (shouldMove ? moveToEnd(side, index) : side))

const MIN_SHARED_ENTRIES = 2

// Local and other both list the shared entries in one order, with additions of
// their own around them, so the claim about an agreed order is always in play
export const agreedOrderSidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .shuffledSubarray(KEYS, { minLength: MIN_SHARED_ENTRIES })
    .chain(keys => fc.tuple(...keys.map(spec.entry)))
    .chain(shared =>
      fc.tuple(
        fc.constant(shared),
        insertionsArb(spec, shared),
        insertionsArb(spec, shared)
      )
    )

export const editOf = (spec: KindSpec, ancestor: Side): fc.Arbitrary<Side> =>
  fc
    .tuple(...ancestor.map(entry => decisionArb(spec, entry)))
    .map(decided => decided.flat())
    .chain(kept => insertionsArb(spec, kept))
    .chain(permuteArb)

export const changedSideArb = (
  spec: KindSpec,
  ancestor: Side
): fc.Arbitrary<Side> => fc.oneof(editOf(spec, ancestor), sideArb(spec))

export const sidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  sideArb(spec).chain(ancestor =>
    fc.tuple(
      fc.constant(ancestor),
      changedSideArb(spec, ancestor),
      changedSideArb(spec, ancestor)
    )
  )

const byKey =
  (spec: KindSpec) =>
  (left: JsonValue, right: JsonValue): number => {
    const [l, r] = [spec.keyOf(left), spec.keyOf(right)]
    return l < r ? -1 : l > r ? 1 : 0
  }

export const retrieveShaped = (spec: KindSpec, side: Side): Side =>
  spec.emission === 'sorted' ? [...side].sort(byKey(spec)) : side

const attributeValue = (side: Side): JsonValue =>
  side.length === 1 ? side[0] : [...side]

export const attributeOf = (
  spec: KindSpec,
  side: Side
): JsonValue | undefined => {
  if (spec.toAttribute) return spec.toAttribute(side)
  return side.length === 0 ? undefined : attributeValue(side)
}

const placed = (spec: KindSpec, value: JsonValue | undefined): JsonObject => {
  if (value === undefined) return {}
  return isRootLevel(spec) ? (value as JsonObject) : { [spec.attribute]: value }
}

const toDoc = (spec: KindSpec, side: Side): JsonObject => ({
  [spec.root]: {
    ...spec.sibling,
    ...placed(spec, attributeOf(spec, side)),
  },
})

// The parser builds every element on a prototype-less object, so a tag named
// like an Object.prototype member reads as absent when it is
const parserShaped = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(parserShaped)
  if (!isPlainObject(value)) return value
  const shaped = createEmptyBody()
  for (const [key, child] of Object.entries(value)) {
    shaped[key] = parserShaped(child)
  }
  return shaped
}

const parsedDoc = (spec: KindSpec, side: Side): JsonObject =>
  parserShaped(toDoc(spec, side)) as JsonObject

export const merge = (
  spec: KindSpec,
  ancestor: Side,
  local: Side,
  other: Side
): MergeOutcome =>
  new JsonMerger(defaultConfig).mergeThreeWay(
    parsedDoc(spec, ancestor),
    parsedDoc(spec, local),
    parsedDoc(spec, other)
  )

export const render = (output: JsonArray): Promise<string> =>
  serializeToString(new XmlStreamWriter(defaultConfig), output, {})

export const entriesFromValue = (spec: KindSpec, value: JsonValue): Side => {
  if (spec.fromAttribute) return spec.fromAttribute(value)
  return Array.isArray(value) ? value : [value]
}

const withoutKeys = (node: JsonObject, keys: string[]): JsonObject =>
  Object.fromEntries(
    Object.entries(node).filter(([name]) => !keys.includes(name))
  )

export const entriesOf = (spec: KindSpec, xml: string): Side => {
  const content = new CompactXmlParser().parseString(xml).content
  const root = content[spec.root] as JsonObject
  const value = isRootLevel(spec)
    ? withoutKeys(root, Object.keys(spec.sibling))
    : root[spec.attribute]
  return value === undefined ? [] : entriesFromValue(spec, value)
}

export const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

export const sideOf = (spec: KindSpec, side: Side, key: string): Side =>
  side.filter(entry => spec.keyOf(entry) === key)

export const asItems = (value: JsonValue | undefined): JsonArray => {
  if (Array.isArray(value)) return value
  if (!isPlainObject(value)) return []
  return Object.entries(value).map(([name, content]) => ({ [name]: content }))
}

export const collectBlocks = (node: JsonValue): ConflictBlock[] => {
  if (Array.isArray(node)) return node.flatMap(collectBlocks)
  if (isConflictBlock(node)) return [node]
  if (!isPlainObject(node)) return []
  return Object.values(node).flatMap(collectBlocks)
}

export const rootItems = (spec: KindSpec, output: JsonArray): JsonArray =>
  asItems((output[0] as JsonObject)[spec.root])

const MAX_COPIES = 2
const MAX_IDENTICAL_COPIES = 3

export const CONFLICT = Symbol('conflict')
export const REMOVED = Symbol('removed')

const copiesArb = (spec: KindSpec, key: string): fc.Arbitrary<Side> =>
  fc
    .integer({ min: 1, max: isText(spec) ? MAX_IDENTICAL_COPIES : MAX_COPIES })
    .chain(count =>
      fc.tuple(...Array.from({ length: count }, () => spec.entry(key)))
    )

const dupSideArb = (spec: KindSpec): fc.Arbitrary<Side> =>
  fc
    .shuffledSubarray(KEYS)
    .chain(keys => fc.tuple(...keys.map(key => copiesArb(spec, key))))
    .map(copies => copies.flat())

const changedDupArb = (spec: KindSpec, ancestor: Side): fc.Arbitrary<Side> =>
  fc.oneof(editOf(spec, ancestor), dupSideArb(spec))

export const dupSidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  dupSideArb(spec).chain(ancestor =>
    fc.tuple(
      fc.constant(ancestor),
      changedDupArb(spec, ancestor),
      changedDupArb(spec, ancestor)
    )
  )

export interface Ent {
  readonly a: JsonValue | undefined
  readonly l: JsonValue | undefined
  readonly o: JsonValue | undefined
}
export type Outcome = JsonValue | typeof CONFLICT | typeof REMOVED

const threeWay = (a: JsonValue, l: JsonValue, o: JsonValue): Outcome => {
  if (same(l, a)) return o
  if (same(o, a) || same(l, o)) return l
  return CONFLICT
}

const fieldWise = (a: JsonObject, l: JsonObject, o: JsonObject): Outcome => {
  const merged: JsonObject = {}
  for (const field of Object.keys(a)) {
    const outcome = threeWay(a[field], l[field], o[field])
    if (outcome === CONFLICT) return CONFLICT
    merged[field] = outcome as JsonValue
  }
  return merged
}

const elementMerge = (a: JsonValue, l: JsonValue, o: JsonValue): Outcome =>
  isPlainObject(a)
    ? fieldWise(a, l as JsonObject, o as JsonObject)
    : threeWay(a, l, o)

const presentWithAncestor = (a: JsonValue, side: JsonValue): Outcome =>
  same(side, a) ? REMOVED : CONFLICT

export const entryOutcome = ({ a, l, o }: Ent): Outcome => {
  if (a !== undefined && l !== undefined && o !== undefined) {
    return elementMerge(a, l, o)
  }
  if (a !== undefined) {
    const kept = l ?? o
    return kept === undefined ? REMOVED : presentWithAncestor(a, kept)
  }
  if (l !== undefined && o !== undefined) return same(l, o) ? l : CONFLICT
  return (l ?? o) as JsonValue
}

const modifiedArb = (spec: KindSpec, entry: JsonValue) =>
  spec.entry(spec.keyOf(entry)).filter(modified => !same(modified, entry))

interface Replacement {
  readonly a: Side
  readonly index: number
  readonly modified: JsonValue
}

export const replacementArb = (spec: KindSpec): fc.Arbitrary<Replacement> =>
  sideArb(spec)
    .filter(a => a.length > 0)
    .chain(a =>
      fc
        .nat({ max: a.length - 1 })
        .chain(index =>
          modifiedArb(spec, a[index]).map(modified => ({ a, index, modified }))
        )
    )

export const unwrap = (item: JsonValue): JsonValue =>
  (item as JsonObject)[ordered.attribute]

export const assertLaw = <T extends unknown[]>(
  property: fc.IAsyncProperty<T>
): Promise<void> => fc.assert(property)

// ---- one entry edited in different fields

export interface FieldSplit {
  readonly a: Side
  readonly l: Side
  readonly o: Side
  readonly both: Side
}

const fieldsOf = (spec: KindSpec, entry: JsonValue): string[] =>
  Object.keys(entry as JsonObject).filter(name => name !== spec.keyProperty)

const withFieldFrom = (
  entry: JsonValue,
  field: string,
  source: JsonValue
): JsonValue => ({
  ...(entry as JsonObject),
  [field]: (source as JsonObject)[field],
})

const changesField = (entry: JsonValue, field: string) => (edit: JsonValue) =>
  !same((edit as JsonObject)[field], (entry as JsonObject)[field])

const editOfField = (
  spec: KindSpec,
  entry: JsonValue,
  field: string
): fc.Arbitrary<JsonValue> =>
  spec.entry(spec.keyOf(entry)).filter(changesField(entry, field))

export const splitFieldsArb = (spec: KindSpec): fc.Arbitrary<FieldSplit> =>
  sideArb(spec)
    .filter(a => a.length > 0)
    .chain(a =>
      fc.nat({ max: a.length - 1 }).chain(index => {
        const entry = a[index]
        const pair = fc.shuffledSubarray(fieldsOf(spec, entry), {
          minLength: 2,
          maxLength: 2,
        })
        return pair.chain(([localField, otherField]) =>
          fc
            .tuple(
              editOfField(spec, entry, localField),
              editOfField(spec, entry, otherField)
            )
            .map(([localEdit, otherEdit]) => {
              const edited = (field: string, source: JsonValue) =>
                a.map((kept, j) =>
                  j === index ? withFieldFrom(kept, field, source) : kept
                )
              const both = withFieldFrom(
                withFieldFrom(entry, localField, localEdit),
                otherField,
                otherEdit
              )
              return {
                a,
                l: edited(localField, localEdit),
                o: edited(otherField, otherEdit),
                both: a.map((kept, j) => (j === index ? both : kept)),
              }
            })
        )
      })
    )

export const permArb = fc.shuffledSubarray(KEYS, {
  minLength: KEYS.length,
  maxLength: KEYS.length,
})

// ---- real metadata types, merged through the whole pipeline

const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

export const ROOT_ATTRIBUTES: JsonObject = { '@_xmlns': METADATA_NAMESPACE }

interface EntryType {
  readonly root: string
  readonly attribute: string
  readonly keyProperty: string
  readonly sibling: JsonObject
  readonly fields: Record<string, fc.Arbitrary<JsonValue>>
  readonly emission: Emission
}

// Fields are declared alphabetically, as a retrieve writes them
const byName = ([left]: [string, unknown], [right]: [string, unknown]) =>
  left < right ? -1 : 1

const entryType = (type: EntryType): KindSpec => ({
  root: type.root,
  attribute: type.attribute,
  sibling: type.sibling,
  entry: key =>
    fc.record(
      Object.fromEntries(
        Object.entries({
          ...type.fields,
          [type.keyProperty]: fc.constant(key),
        }).sort(byName)
      )
    ),
  keyOf: entry => fieldOf(entry, type.keyProperty),
  emission: type.emission,
  relabel: (entry, to) => ({
    ...(entry as JsonObject),
    [type.keyProperty]: to,
  }),
  keyProperty: type.keyProperty,
})

const permissionSetObjects = entryType({
  root: 'PermissionSet',
  attribute: 'objectPermissions',
  keyProperty: 'object',
  sibling: { label: 'P' },
  fields: { allowCreate: FIELD_TEXT, allowRead: FIELD_TEXT },
  emission: 'sorted',
})

const customLabels = entryType({
  root: 'CustomLabels',
  attribute: 'labels',
  keyProperty: 'fullName',
  sibling: {},
  fields: {
    language: fc.constantFrom('en_US', 'fr'),
    protected: BOOLEAN_TEXT,
    value: LABEL_TEXT,
  },
  emission: 'sorted',
})

const standardValueSet = entryType({
  root: 'StandardValueSet',
  attribute: 'standardValue',
  keyProperty: 'fullName',
  sibling: { sorted: 'false' },
  fields: { default: BOOLEAN_TEXT, label: LABEL_TEXT },
  emission: 'positional',
})

export const unorderedTypes: readonly KindSpec[] = [
  keyed,
  permissionSetObjects,
  customLabels,
]

export const orderedTypes: readonly KindSpec[] = [ordered, standardValueSet]

const typeName = (spec: KindSpec): string => `${spec.root}.${spec.attribute}`

// A root with no sibling has nothing but the entries: the type alone must
// drive the merge (ADR 072)
export const withoutSibling = (spec: KindSpec): KindSpec => ({
  ...spec,
  sibling: {},
})

export const namedTypes = (
  specs: readonly KindSpec[]
): (readonly [string, KindSpec])[] =>
  specs.map(spec => [typeName(spec), spec] as const)

const hasSibling = (spec: KindSpec): boolean =>
  Object.keys(spec.sibling).length > 0

export const namedTypesWithoutSibling = (
  specs: readonly KindSpec[]
): (readonly [string, KindSpec])[] => [
  ...namedTypes(specs),
  ...specs
    .filter(hasSibling)
    .map(
      spec =>
        [`${typeName(spec)} without sibling`, withoutSibling(spec)] as const
    ),
]

export const xmlOf = (
  spec: KindSpec,
  side: Side,
  rootAttributes: JsonObject = ROOT_ATTRIBUTES
): Promise<string> =>
  serializeToString(
    new XmlStreamWriter(defaultConfig),
    [toDoc(spec, side)],
    rootAttributes
  )

export const mergeXml = ([ancestor, local, other]: readonly [
  string,
  string,
  string,
]): Promise<{ output: string; hasConflict: boolean }> =>
  mergeXmlStrings(new XmlMerger(defaultConfig), ancestor, local, other)

export const mergeFile = async (
  spec: KindSpec,
  [ancestor, local, other]: readonly [Side, Side, Side]
): Promise<{ output: string; hasConflict: boolean }> =>
  mergeXml([
    await xmlOf(spec, ancestor),
    await xmlOf(spec, local),
    await xmlOf(spec, other),
  ])

export const parseXml = (xml: string): NormalisedParseResult =>
  new CompactXmlParser().parseString(xml)

export const entryTokens = (spec: KindSpec, xml: string): string[] =>
  entriesOf(spec, xml)
    .map(entry => JSON.stringify(entry))
    .sort()

// ---- contested sides

// A deletion against a modification is the conflict every kind surfaces as a
// block over the entry's key; copies of a text value contest by their count
const COPIES_KEPT_BY_ONE = 2
const COPIES_KEPT_BY_OTHER = 1
const CONTESTED_COPIES = 3

const mirrored = (
  [a, l, o]: readonly [Side, Side, Side],
  flip: boolean
): readonly [Side, Side, Side] => (flip ? [a, o, l] : [a, l, o])

const contestedEntryArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(
      replacementArb(spec).filter(({ a }) => a.length > 1),
      fc.boolean()
    )
    .map(([{ a, index, modified }, flip]) =>
      mirrored(
        [
          a,
          a.filter((_, j) => j !== index),
          a.map((entry, j) => (j === index ? modified : entry)),
        ],
        flip
      )
    )

// One side empties the file, the other edits one entry: the entries the other
// left alone are settled by the deletion, only the edited one is contested
const contestedEmptiedArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(
      replacementArb(spec).filter(({ a }) => a.length > 1),
      fc.boolean()
    )
    .map(([{ a, index, modified }, flip]) =>
      mirrored(
        [a, a.map((entry, j) => (j === index ? modified : entry)), []],
        flip
      )
    )

// ---- contested child-tag order

const MIN_TAGS_FOR_A_CYCLE = 4
const MAX_MOVES_PER_SIDE = 2

const relocated = <T>(
  side: readonly T[],
  [from, to]: readonly [number, number]
): T[] => {
  const moved = [...side]
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved
}

const movesArb = (size: number) =>
  fc.array(fc.tuple(fc.nat({ max: size - 1 }), fc.nat({ max: size - 1 })), {
    minLength: 1,
    maxLength: MAX_MOVES_PER_SIDE,
  })

const tagsOf = (spec: KindSpec, side: Side): string[] => side.map(spec.keyOf)

// Tags every side carries that the reference leaves out of every block
const settledTags = (spec: KindSpec, [a, l, o]: readonly Side[]): string[] => {
  const [ancestor, local, other] = [a, l, o].map(side => tagsOf(spec, side))
  const blocked = referenceOrder(ancestor, local, other).blocks.flat()
  return ancestor.filter(
    tag => local.includes(tag) && other.includes(tag) && !blocked.includes(tag)
  )
}

const hasBlocks = (spec: KindSpec, [a, l, o]: readonly Side[]): boolean =>
  referenceOrder(tagsOf(spec, a), tagsOf(spec, l), tagsOf(spec, o)).blocks
    .length > 0

type TagAdder = (side: Side) => Side

interface ExtraTag {
  readonly local: TagAdder
  // Present when both sides add the tag, each at a place of its own
  readonly other: TagAdder | undefined
}

const BOTH_ADD_WEIGHT = 1
const LOCAL_ADDS_WEIGHT = 2

const adderAt =
  (entry: JsonValue, at: number): TagAdder =>
  side =>
    side.toSpliced(at, 0, entry)

// A tag the ancestor does not carry, written among the moved ones: by local
// alone, or by both sides at places that need not agree
const extraTagArb = (
  spec: KindSpec,
  ancestor: Side
): fc.Arbitrary<ExtraTag | undefined> => {
  const unused = KEYS.filter(key => !tagsOf(spec, ancestor).includes(key))
  if (unused.length === 0) return fc.constant(undefined)
  const place = fc.nat({ max: ancestor.length })
  const bothAdd = fc.oneof(
    { weight: BOTH_ADD_WEIGHT, arbitrary: fc.constant(true) },
    { weight: LOCAL_ADDS_WEIGHT, arbitrary: fc.constant(false) }
  )
  return fc
    .tuple(fc.constantFrom(...unused), place, place, bothAdd)
    .chain(([key, localAt, otherAt, both]) =>
      spec.entry(key).map(
        (entry): ExtraTag => ({
          local: adderAt(entry, localAt),
          other: both ? adderAt(entry, otherAt) : undefined,
        })
      )
    )
}

// Overlapping moves on both sides of a few tags, so that the pairs they
// invert cycle; the tags neither side moved stand between the cycle tags
export const contestedOrderArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .shuffledSubarray(KEYS, { minLength: MIN_TAGS_FOR_A_CYCLE })
    .chain(keys => fc.tuple(...keys.map(spec.entry)))
    .chain(ancestor =>
      fc.tuple(
        fc.constant(ancestor),
        movesArb(ancestor.length),
        movesArb(ancestor.length),
        extraTagArb(spec, ancestor)
      )
    )
    .map(([ancestor, localMoves, otherMoves, extra]) => {
      const local = localMoves.reduce(relocated, ancestor)
      const other = otherMoves.reduce(relocated, ancestor)
      return [
        ancestor,
        extra ? extra.local(local) : local,
        extra?.other ? extra.other(other) : other,
      ] as const
    })
    .filter(
      sides => hasBlocks(spec, sides) && settledTags(spec, sides).length > 0
    )

// ---- contested child-tag order inside one entry

const fieldTagsOf = (entry: JsonValue): string[] =>
  Object.keys(entry as JsonObject)

const withTagOrder = (entry: JsonValue, tags: readonly string[]): JsonValue =>
  Object.fromEntries(tags.map(tag => [tag, (entry as JsonObject)[tag]]))

type TagOrders = readonly [string[], string[], string[]]

// One entry whose values are equal on every side and whose tags the sides move
// into orders no single order holds: only the order of its tags is contested
export const contestedEntryOrderArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(fc.constantFrom(...KEYS).chain(spec.entry), fc.boolean())
    .chain(([entry, flip]) => {
      const tags = fieldTagsOf(entry)
      return fc
        .tuple(movesArb(tags.length), movesArb(tags.length))
        .map(([localMoves, otherMoves]) => ({
          entry,
          flip,
          orders: [
            tags,
            localMoves.reduce(relocated, tags),
            otherMoves.reduce(relocated, tags),
          ] as TagOrders,
        }))
    })
    .filter(
      ({ orders: [a, l, o] }) => referenceOrder(a, l, o).blocks.length > 0
    )
    .map(({ entry, flip, orders: [a, l, o] }) =>
      mirrored(
        [
          [withTagOrder(entry, a)],
          [withTagOrder(entry, l)],
          [withTagOrder(entry, o)],
        ],
        flip
      )
    )

const contestedCopiesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc
    .tuple(fc.constantFrom(...KEYS), sideArb(spec), fc.boolean())
    .map(([key, others, flip]) => {
      const copy = spec.relabel('', key)
      const rest = others.filter(entry => spec.keyOf(entry) !== key)
      const copies = (count: number): Side => Array(count).fill(copy)
      return mirrored(
        [
          [...rest, ...copies(CONTESTED_COPIES)],
          [...rest, ...copies(COPIES_KEPT_BY_ONE)],
          [...rest, ...copies(COPIES_KEPT_BY_OTHER)],
        ],
        flip
      )
    })

const contestedArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> => {
  if (isText(spec)) return contestedCopiesArb(spec)
  const arms = [
    { weight: ENTRY_WEIGHT, arbitrary: contestedEntryArb(spec) },
    { weight: EMPTIED_WEIGHT, arbitrary: contestedEmptiedArb(spec) },
  ]
  if (!isProperty(spec)) return fc.oneof(...arms)
  return fc.oneof(...arms, {
    weight: ORDER_WEIGHT,
    arbitrary: contestedOrderArb(spec),
  })
}

// Most runs contest one entry among untouched ones, so the claim is exercised;
// the free sides keep the unforeseen shapes in play
const CONTESTED_WEIGHT = 4
const FREE_WEIGHT = 1
const ENTRY_WEIGHT = 2
const EMPTIED_WEIGHT = 1
const ORDER_WEIGHT = 3

export const contestedSidesArb = (
  spec: KindSpec
): fc.Arbitrary<readonly [Side, Side, Side]> =>
  fc.oneof(
    { weight: CONTESTED_WEIGHT, arbitrary: contestedArb(spec) },
    {
      weight: FREE_WEIGHT,
      arbitrary: isText(spec) ? dupSidesArb(spec) : sidesArb(spec),
    }
  )
