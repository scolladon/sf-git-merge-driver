import {
  every,
  isArray,
  isString,
  isObject as lodashIsObject,
  some,
} from 'lodash-es'
import { MetadataService } from '../../service/MetadataService.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import { KeyedArrayMergeNode } from './KeyedArrayMergeNode.js'
import type { MergeNode } from './MergeNode.js'
import { ensureArray } from './nodeUtils.js'
import { ObjectMergeNode } from './ObjectMergeNode.js'
import { TextArrayMergeNode } from './TextArrayMergeNode.js'
import { TextMergeNode } from './TextMergeNode.js'

const isKnownObject = (...values: (JsonValue | undefined | null)[]): boolean =>
  some(values, lodashIsObject)

const isStringArray = (...values: (JsonValue | undefined | null)[]): boolean =>
  some(values, value => isArray(value) && every(value, isString))

const isPureObject = (val: JsonValue | undefined | null): boolean =>
  lodashIsObject(val) && !isArray(val)

/**
 * Check if values should be merged as pure objects (property-by-property).
 * Returns true when all values are objects (not arrays) AND the attribute
 * has no key extractor defined (otherwise it should be a keyed array).
 */
const isPureUnknown = (
  values: (JsonValue | undefined | null)[],
  attribute: string
): boolean => {
  const hasKeyExtractor =
    MetadataService.getKeyFieldExtractor(attribute) !== undefined
  const hasPureObject = some(values, isPureObject)
  const hasArray = some(values, isArray)

  return !hasKeyExtractor && hasPureObject && !hasArray
}

export interface MergeNodeFactory {
  createNode(
    ancestor: JsonValue,
    local: JsonValue,
    other: JsonValue,
    attribute: string
  ): MergeNode
}

export class DefaultMergeNodeFactory implements MergeNodeFactory {
  createNode(
    ancestor: JsonValue,
    local: JsonValue,
    other: JsonValue,
    attribute: string
  ): MergeNode {
    // String arrays → TextArrayMergeNode
    if (isStringArray(ancestor, local, other)) {
      const [ancestorArr, localArr, otherArr] = [ancestor, local, other].map(
        ensureArray
      )
      return new TextArrayMergeNode(
        ancestorArr as JsonArray,
        localArr as JsonArray,
        otherArr as JsonArray,
        attribute
      )
    }

    // Pure objects without key extractor → ObjectMergeNode (property-by-property)
    if (isPureUnknown([ancestor, local, other], attribute)) {
      return new ObjectMergeNode(
        ancestor as JsonObject,
        local as JsonObject,
        other as JsonObject
      )
    }

    // Arrays/objects containing objects with known key extractor → KeyedArrayMergeNode
    if (isKnownObject(ancestor, local, other)) {
      const [ancestorArr, localArr, otherArr] = [ancestor, local, other].map(
        ensureArray
      )
      return new KeyedArrayMergeNode(
        ancestorArr as JsonArray,
        localArr as JsonArray,
        otherArr as JsonArray,
        attribute
      )
    }

    return new TextMergeNode(ancestor, local, other, attribute)
  }
}

export const defaultNodeFactory = new DefaultMergeNodeFactory()
