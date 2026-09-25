import { MetadataService } from '../../service/MetadataService.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import { KeyedArrayMergeNode } from './KeyedArrayMergeNode.js'
import type { MergeNode } from './MergeNode.js'
import { PropertyMergeNode } from './PropertyMergeNode.js'
import { TextArrayMergeNode } from './TextArrayMergeNode.js'
import { TextMergeNode } from './TextMergeNode.js'

const toArray = (v: JsonValue | undefined): JsonArray =>
  v == null ? [] : Array.isArray(v) ? (v as JsonArray) : ([v] as JsonArray)

const isObject = (val: unknown): boolean =>
  typeof val === 'object' && val !== null

const isKnownObject = (...values: (JsonValue | undefined | null)[]): boolean =>
  values.some(isObject)

const isStringArray = (...values: (JsonValue | undefined | null)[]): boolean =>
  values.some(
    value =>
      Array.isArray(value) &&
      (value as unknown[]).every(el => typeof el === 'string')
  )

const isPureObject = (val: JsonValue | undefined | null): boolean =>
  // Stryker disable next-line ConditionalExpression: only read once a side is an object or array, so with no array one is a pure object
  // Stryker disable next-line LogicalOperator: only read once a side is an object or array, so with no array one is a pure object
  isObject(val) && !Array.isArray(val)

// undefined is scalar: an absent side carries no object or array shape
// either, so it must not block the early exit below.
const isScalar = (val: JsonValue | undefined): boolean =>
  val === null || typeof val !== 'object'

// Shared, frozen and prototype-free. The parser builds every node with
// Object.create(null) so that an untrusted XML tag name cannot resolve
// through Object.prototype; a plain {} here would reintroduce that chain
// and make a side that dropped an element look like it still carried
// `constructor`, `toString` and their siblings.
const NO_PROPERTIES: JsonObject = Object.freeze(Object.create(null))

// Only an absent side is normalised. A scalar side is passed through so a
// text-bodied element keeps merging exactly as it did before this helper
// existed; isPureUnknown has already ruled out arrays.
const toPropertyObject = (val: JsonValue | undefined): JsonObject =>
  val == null ? NO_PROPERTIES : (val as JsonObject)

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
): MergeNode =>
  new PropertyMergeNode(
    toPropertyObject(ancestor),
    toPropertyObject(local),
    toPropertyObject(other),
    attribute
  )

// Reached only when at least one side is an object or array: the scalar
// and text-array routes have already claimed every all-scalar trio.
const toKeyedArrayNode = (
  sides: readonly [Side, Side, Side],
  attribute: string,
  keyField: ReturnType<typeof MetadataService.getKeyFieldExtractor>
): MergeNode => {
  const [ancestorArr, localArr, otherArr] = toArrays(...sides)
  return new KeyedArrayMergeNode(
    ancestorArr,
    localArr,
    otherArr,
    attribute,
    keyField,
    MetadataService.isOrderedAttribute(attribute)
  )
}

class DefaultMergeNodeFactory implements MergeNodeFactory {
  createNode(
    ancestor: Side,
    local: Side,
    other: Side,
    attribute: string
  ): MergeNode {
    if (isScalarTrio(ancestor, local, other, attribute)) {
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
