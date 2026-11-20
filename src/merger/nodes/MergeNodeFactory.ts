import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../../constant/parserConstant.js'
import { MetadataService } from '../../service/MetadataService.js'
import type { JsonArray, JsonValue } from '../../types/jsonTypes.js'
import { KeyedArrayMergeNode } from './KeyedArrayMergeNode.js'
import type { MergeNode } from './MergeNode.js'
import { PropertyMergeNode } from './PropertyMergeNode.js'
import { TextArrayMergeNode } from './TextArrayMergeNode.js'
import { TextMergeNode } from './TextMergeNode.js'
import { isObject, isPureObject, isSingleValueTrio } from './valueKind.js'

const toArray = (v: JsonValue | undefined): JsonArray =>
  v == null ? [] : Array.isArray(v) ? (v as JsonArray) : ([v] as JsonArray)

const isKnownObject = (...values: (JsonValue | undefined | null)[]): boolean =>
  values.some(isObject)

const isStringArray = (...values: (JsonValue | undefined | null)[]): boolean =>
  values.some(
    value =>
      Array.isArray(value) &&
      (value as unknown[]).every(el => typeof el === 'string')
  )

const isPureUnknown = (
  values: (JsonValue | undefined | null)[],
  hasKeyExtractor: boolean
): boolean => {
  const hasPureObject = values.some(isPureObject)
  const hasArray = values.some(Array.isArray)

  return !hasKeyExtractor && hasPureObject && !hasArray
}

export interface MergeNodeFactory {
  createNode(
    ancestor: JsonValue | undefined,
    local: JsonValue | undefined,
    other: JsonValue | undefined,
    attribute: string
  ): MergeNode
}

type Side = JsonValue | undefined

const toArrays = (...sides: Side[]): JsonArray[] => sides.map(toArray)

// The CDATA sections, or the comments, beside child tags: the parser keeps
// them under one content key, as an array when adjacent. Its parts are one
// ordered value, never a set of items to sort and union: a CDATA escape split
// across two sections would be reordered into another text.
const isContentParts = (attribute: string): boolean =>
  attribute === CDATA_PROP_NAME || attribute === XML_COMMENT_PROP_NAME

// The schema override defeats an incidental cardinality check, not the
// shape checks: TextArrayMergeNode compares items by reference and sorts
// them by JSON.stringify, so it only ever holds for scalars.
const isTextArray = (
  ancestor: Side,
  local: Side,
  other: Side,
  attribute: string
): boolean =>
  isStringArray(ancestor, local, other) ||
  (MetadataService.isTextArrayAttribute(attribute) &&
    !isKnownObject(ancestor, local, other))

const toTextArrayNode = (
  ancestor: Side,
  local: Side,
  other: Side,
  attribute: string
): MergeNode => {
  const [ancestorArr, localArr, otherArr] = toArrays(ancestor, local, other)
  return new TextArrayMergeNode(ancestorArr, localArr, otherArr, attribute)
}

const toPropertyNode = (
  ancestor: Side,
  local: Side,
  other: Side,
  attribute: string
): MergeNode => new PropertyMergeNode(ancestor, local, other, attribute)

// Reached only when at least one side is an object or array: the scalar
// and text-array routes have already claimed every all-scalar trio.
const toKeyedArrayNode = (
  sides: readonly [Side, Side, Side],
  attribute: string,
  keyField: ReturnType<typeof MetadataService.getKeyFieldExtractor>
): MergeNode => {
  const sideArrays = toArrays(...sides)
  const [ancestorArr, localArr, otherArr] = sideArrays
  return new KeyedArrayMergeNode(
    ancestorArr,
    localArr,
    otherArr,
    attribute,
    keyField,
    MetadataService.isOrderedAttribute(attribute, sideArrays)
  )
}

class DefaultMergeNodeFactory implements MergeNodeFactory {
  createNode(
    ancestor: Side,
    local: Side,
    other: Side,
    attribute: string
  ): MergeNode {
    if (
      isContentParts(attribute) ||
      isSingleValueTrio(ancestor, local, other, attribute)
    ) {
      return new TextMergeNode(ancestor, local, other, attribute)
    }
    if (isTextArray(ancestor, local, other, attribute)) {
      return toTextArrayNode(ancestor, local, other, attribute)
    }
    const keyField = MetadataService.getKeyFieldExtractor(attribute)
    if (isPureUnknown([ancestor, local, other], keyField !== undefined)) {
      return toPropertyNode(ancestor, local, other, attribute)
    }
    return toKeyedArrayNode([ancestor, local, other], attribute, keyField)
  }
}

export const defaultNodeFactory = new DefaultMergeNodeFactory()
