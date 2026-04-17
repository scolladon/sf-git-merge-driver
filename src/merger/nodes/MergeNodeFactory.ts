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
    if (isStringArray(ancestor, local, other)) {
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
        ancestor as JsonObject,
        local as JsonObject,
        other as JsonObject,
        attribute
      )
    }

    if (isKnownObject(ancestor, local, other)) {
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

    return new TextMergeNode(ancestor, local, other, attribute)
  }
}

export const defaultNodeFactory = new DefaultMergeNodeFactory()
