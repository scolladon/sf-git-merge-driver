import {
  every,
  isArray,
  isString,
  isObject as lodashIsObject,
  some,
} from 'lodash-es'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import { KeyedArrayMergeNode } from './KeyedArrayMergeNode.js'
import type { MergeNode } from './MergeNode.js'
import { ensureArray } from './nodeUtils.js'
import { ObjectMergeNode } from './ObjectMergeNode.js'
import { TextArrayMergeNode } from './TextArrayMergeNode.js'
import { TextMergeNode } from './TextMergeNode.js'

const hasObject = (...values: (JsonValue | undefined | null)[]): boolean =>
  some(values, lodashIsObject)

const hasStringArray = (...values: (JsonValue | undefined | null)[]): boolean =>
  some(values, value => isArray(value) && every(value, isString))

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
    const [ancestorArr, localArr, otherArr] = [ancestor, local, other].map(
      ensureArray
    )
    // ...

    if (hasStringArray(ancestor, local, other)) {
      return new TextArrayMergeNode(
        ancestorArr as JsonArray,
        localArr as JsonArray,
        otherArr as JsonArray,
        attribute
      )
    }

    // New logic: Check if purely objects (not arrays)
    const isPureObject = (val: JsonValue | undefined) =>
      lodashIsObject(val) && !isArray(val)

    if (
      some([ancestor, local, other], isPureObject) &&
      !some([ancestor, local, other], isArray)
    ) {
      return new ObjectMergeNode(
        ancestor as JsonObject,
        local as JsonObject,
        other as JsonObject
      )
    }

    if (hasObject(ancestor, local, other)) {
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
