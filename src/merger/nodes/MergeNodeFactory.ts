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

class DefaultMergeNodeFactory implements MergeNodeFactory {
  createNode(
    ancestor: JsonValue | undefined,
    local: JsonValue | undefined,
    other: JsonValue | undefined,
    attribute: string
  ): MergeNode {
    if (
      isScalar(ancestor) &&
      isScalar(local) &&
      isScalar(other) &&
      !MetadataService.isTextArrayAttribute(attribute)
    ) {
      return new TextMergeNode(ancestor, local, other, attribute)
    }

    // The schema override defeats an incidental cardinality check, not the
    // shape checks below it: TextArrayMergeNode compares items by reference
    // and sorts them by JSON.stringify, so it only ever holds for scalars.
    if (
      isStringArray(ancestor, local, other) ||
      (MetadataService.isTextArrayAttribute(attribute) &&
        !isKnownObject(ancestor, local, other))
    ) {
      const [ancestorArr, localArr, otherArr] = [ancestor, local, other].map(
        toArray
      )
      return new TextArrayMergeNode(
        ancestorArr as JsonArray,
        localArr as JsonArray,
        otherArr as JsonArray,
        attribute
      )
    }

    const keyField = MetadataService.getKeyFieldExtractor(attribute)

    if (isPureUnknown([ancestor, local, other], keyField !== undefined)) {
      return new PropertyMergeNode(
        toPropertyObject(ancestor),
        toPropertyObject(local),
        toPropertyObject(other),
        attribute
      )
    }

    // Reaching here means at least one side is an object or array: the
    // early exit above already returned for an all-scalar, non-text-array
    // trio, and the text-array branch above already returned for an
    // all-scalar trio on a text-array attribute. isKnownObject is
    // therefore always true, so this is the routing's final node type.
    const [ancestorArr, localArr, otherArr] = [ancestor, local, other].map(
      toArray
    )
    return new KeyedArrayMergeNode(
      ancestorArr as JsonArray,
      localArr as JsonArray,
      otherArr as JsonArray,
      attribute,
      keyField,
      MetadataService.isOrderedAttribute(attribute)
    )
  }
}

export const defaultNodeFactory = new DefaultMergeNodeFactory()
