import {
  ATTR_PREFIX,
  CDATA_PROP_NAME,
  TEXT_TAG,
  XML_COMMENT_PROP_NAME,
} from '../../constant/parserConstant.js'
import { MetadataService } from '../../service/MetadataService.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'

// The kind of value one side holds at a tag. Two sides of different kinds do
// not share a shape that can be merged part by part: their change is one
// change of the whole value.
export const ValueKind = {
  ABSENT: 'absent',
  EMPTY: 'empty',
  TEXT: 'text',
  CDATA_ONLY: 'cdata-only',
  COMMENT_ONLY: 'comment-only',
  CONTENT_ONLY: 'cdata-and-comment-only',
  TEXT_AND_CDATA: 'text-and-cdata',
  TEXT_AND_COMMENT: 'text-and-comment',
  TEXT_AND_CONTENT: 'text-cdata-and-comment',
  PARTS: 'several-parts',
  MIXED: 'mixed',
  ELEMENT: 'element',
  REPEATED: 'repeated',
} as const

export type ValueKind = (typeof ValueKind)[keyof typeof ValueKind]

type Side = JsonValue | undefined

const EMPTY_TEXT = ''

const HAS_TEXT = 1
const HAS_CDATA = 2
const HAS_COMMENT = 4

const NO_CONTENT = 0

// Comparing the three names is cheaper than a table lookup, which walks the
// prototype chain for every tag name that is not content: this runs for each
// matched entry of a large array.
const contentFlagOf = (key: string): number => {
  if (key === TEXT_TAG) return HAS_TEXT
  if (key === CDATA_PROP_NAME) return HAS_CDATA
  if (key === XML_COMMENT_PROP_NAME) return HAS_COMMENT
  return NO_CONTENT
}

// One kind for each combination of text, CDATA and comment: merging two
// different combinations part by part would build a content no side held
const KIND_OF_CONTENT: Readonly<Record<number, ValueKind>> = {
  [HAS_TEXT]: ValueKind.TEXT,
  [HAS_CDATA]: ValueKind.CDATA_ONLY,
  [HAS_COMMENT]: ValueKind.COMMENT_ONLY,
  [HAS_CDATA | HAS_COMMENT]: ValueKind.CONTENT_ONLY,
  [HAS_TEXT | HAS_CDATA]: ValueKind.TEXT_AND_CDATA,
  [HAS_TEXT | HAS_COMMENT]: ValueKind.TEXT_AND_COMMENT,
  [HAS_TEXT | HAS_CDATA | HAS_COMMENT]: ValueKind.TEXT_AND_CONTENT,
}

// Parts of one text, kept together: merging them one by one builds a text no
// side held. Text beside child tags is still text: there is no entry to merge
// it by.
const MULTI_PART_TEXT_KINDS: ReadonlySet<ValueKind> = new Set([
  ValueKind.PARTS,
  ValueKind.CONTENT_ONLY,
  ValueKind.TEXT_AND_CDATA,
  ValueKind.TEXT_AND_COMMENT,
  ValueKind.TEXT_AND_CONTENT,
  ValueKind.MIXED,
])

// Adjacent CDATA sections, or adjacent comments, parse as an array under one
// content key: the parts of one value, whatever kind they are.
type Kinds = readonly [ValueKind, ValueKind, ValueKind]

const kindsOf = (ancestor: Side, local: Side, other: Side): Kinds => [
  valueKindOf(ancestor),
  valueKindOf(local),
  valueKindOf(other),
]

const isRepeated = ([a, l, o]: Kinds): boolean =>
  a === ValueKind.REPEATED ||
  l === ValueKind.REPEATED ||
  o === ValueKind.REPEATED

const isMultiPart = ([a, l, o]: Kinds): boolean =>
  MULTI_PART_TEXT_KINDS.has(a) ||
  MULTI_PART_TEXT_KINDS.has(l) ||
  MULTI_PART_TEXT_KINDS.has(o)

// An absent side is no kind: the sides that exist are compared
const differInKind = (kinds: Kinds): boolean => {
  let first: ValueKind | undefined
  for (const kind of kinds) {
    if (kind === ValueKind.ABSENT) continue
    if (first === undefined) first = kind
    else if (kind !== first) return true
  }
  return false
}

const contentKindOf = (value: JsonObject): ValueKind => {
  let content = 0
  let hasTag = false
  let hasParts = false
  for (const key in value) {
    const flag = contentFlagOf(key)
    if (flag === NO_CONTENT) hasTag = true
    else {
      content |= flag
      hasParts ||= Array.isArray(value[key])
    }
  }
  if (hasTag) return content & HAS_TEXT ? ValueKind.MIXED : ValueKind.ELEMENT
  if (hasParts) return ValueKind.PARTS
  return KIND_OF_CONTENT[content] ?? ValueKind.ELEMENT
}

export const valueKindOf = (side: Side): ValueKind => {
  if (side === undefined || side === null) return ValueKind.ABSENT
  if (Array.isArray(side)) return ValueKind.REPEATED
  if (typeof side === 'object') return contentKindOf(side)
  return side === EMPTY_TEXT ? ValueKind.EMPTY : ValueKind.TEXT
}

// One value, merged whole: a side holds a text of several parts, or the sides
// that exist differ in kind. A repeated element keeps its own routes, entry by
// entry. The kinds are read once: this runs for each matched entry of a large
// array.
export const holdsOneValue = (
  ancestor: Side,
  local: Side,
  other: Side
): boolean => {
  const kinds = kindsOf(ancestor, local, other)
  return !isRepeated(kinds) && (isMultiPart(kinds) || differInKind(kinds))
}

export const isObject = (val: unknown): boolean =>
  typeof val === 'object' && val !== null

export const isPureObject = (val: JsonValue | undefined | null): boolean =>
  // Stryker disable next-line ConditionalExpression: only read once a side is an object or array, so with no array one is a pure object
  // Stryker disable next-line LogicalOperator: only read once a side is an object or array, so with no array one is a pure object
  isObject(val) && !Array.isArray(val)

// undefined is scalar: an absent side carries no object or array shape
// either, so it must not block the early exit below.
const isScalar = (val: JsonValue | undefined): boolean =>
  val === null || typeof val !== 'object'

// A leaf trio skips the shape probes below entirely: it is the dominant
// case in Salesforce metadata and can only ever be a TextMergeNode.
const isScalarTrio = (
  ancestor: Side,
  local: Side,
  other: Side,
  attribute: string
): boolean =>
  isScalar(ancestor) &&
  isScalar(local) &&
  isScalar(other) &&
  !MetadataService.isTextArrayAttribute(attribute)

const hasAttributes = (val: Side): boolean => {
  // Stryker disable next-line ConditionalExpression: for-in over a scalar only yields index keys, never an `@_` one; the guard skips that walk
  if (!isPureObject(val)) return false
  for (const key in val as JsonObject) {
    if (key.startsWith(ATTR_PREFIX)) return true
  }
  return false
}

// An attribute only exists on its own element's open tag, so an element
// carrying one (e.g. `<label xsi:nil="true"/>`, parsed as
// `{ '@_xsi:nil': 'true', '#text': '' }`) is merged as one value. A
// property-by-property merge would hand each `@_name` key back to the
// writer as a child element of its own (`<@_xsi:nil>true</@_xsi:nil>`),
// and a text-bodied side would be indexed character by character. A
// repeated element (array side) keeps the array routes below; after matching
// keys, the unordered array strategy applies this rule to each entry too.
const isAttributedTrio = (ancestor: Side, local: Side, other: Side): boolean =>
  !Array.isArray(ancestor) &&
  !Array.isArray(local) &&
  !Array.isArray(other) &&
  (hasAttributes(ancestor) || hasAttributes(local) || hasAttributes(other))

// Merged as one value rather than child by child. A text and an element at
// one tag, an empty element and an element, a CDATA section and a comment are
// kinds of value, not a value and its children: merged part by part, a text
// would be read as an object and its characters taken for tags, and a
// comment or CDATA would be dropped or crossed with the other kind. A text
// of several parts is one value too, even when every side holds the same
// kind: two sides editing different parts would otherwise build a text
// neither held.
export const isWholeValueTrio = (
  ancestor: Side,
  local: Side,
  other: Side
): boolean =>
  isAttributedTrio(ancestor, local, other) ||
  holdsOneValue(ancestor, local, other)

// One value, merged whole by a TextMergeNode, wherever it sits: under a tag
// or as the body of the root element
export const isSingleValueTrio = (
  ancestor: Side,
  local: Side,
  other: Side,
  attribute: string
): boolean =>
  isScalarTrio(ancestor, local, other, attribute) ||
  isWholeValueTrio(ancestor, local, other)
