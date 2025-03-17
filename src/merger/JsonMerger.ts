import { castArray, differenceWith, isEqual, isNil, unionWith } from 'lodash-es'
import { KEY_FIELD_METADATA } from '../constant/metadataConstant.js'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray

interface JsonObject {
  [key: string]: JsonValue
}

interface JsonArray extends Array<JsonValue> {}

export class JsonMerger {
  /**
   * Main entry point for merging JSON values
   */
  mergeObjects(
    ancestor: JsonValue | undefined,
    ours: JsonValue,
    theirs: JsonValue
  ): JsonValue {
    // Handle root object (e.g., Profile)
    if (
      typeof ours === 'object' &&
      ours !== null &&
      !Array.isArray(ours) &&
      typeof theirs === 'object' &&
      theirs !== null &&
      !Array.isArray(theirs)
    ) {
      // Get the base attribute (e.g., Profile)
      const baseKey = Object.keys(ours)[0]
      if (baseKey && Object.keys(theirs)[0] === baseKey) {
        const result = { ...ours } as JsonObject

        // Get the content of the base attribute
        const ourContent = ours[baseKey] as JsonObject
        const theirContent = theirs[baseKey] as JsonObject
        const ancestorContent =
          ancestor &&
          typeof ancestor === 'object' &&
          !Array.isArray(ancestor) &&
          baseKey in ancestor
            ? ((ancestor as JsonObject)[baseKey] as JsonObject)
            : {}

        // Get all properties from both contents
        const allProperties = new Set([
          ...Object.keys(ourContent),
          ...Object.keys(theirContent),
        ])

        // Process each property
        const mergedContent = { ...ourContent } as JsonObject
        for (const property of allProperties) {
          // Skip if property doesn't exist in their content
          if (!(property in theirContent)) continue

          // Use their version if property doesn't exist in our content
          if (!(property in mergedContent)) {
            mergedContent[property] = this.ensureArray(theirContent[property])
            continue
          }

          // Ensure both values are arrays
          const ourArray = this.ensureArray(mergedContent[property])
          const theirArray = this.ensureArray(theirContent[property])
          const ancestorArray =
            property in ancestorContent
              ? this.ensureArray(ancestorContent[property])
              : []

          // Get the key field for this property if available
          const keyField = this.getKeyField(property)

          // Merge the arrays
          mergedContent[property] = this.mergeArrays(
            ancestorArray,
            ourArray,
            theirArray,
            keyField
          )
        }

        result[baseKey] = mergedContent
        return result
      }
    }

    // Default to our version for other cases
    return ours
  }

  /**
   * Ensures a value is an array
   */
  private ensureArray(value: JsonValue): JsonArray {
    return isNil(value) ? [] : (castArray(value) as JsonArray)
  }

  /**
   * Gets the key field for a property from KEY_FIELD_METADATA
   */
  private getKeyField(property: string): string | undefined {
    return property in KEY_FIELD_METADATA
      ? KEY_FIELD_METADATA[property as keyof typeof KEY_FIELD_METADATA]
      : undefined
  }

  /**
   * Merges arrays using the specified key field if available
   */
  private mergeArrays(
    ancestor: JsonArray,
    ours: JsonArray,
    theirs: JsonArray,
    keyField?: string
  ): JsonArray {
    // If no key field, use unionWith to merge arrays without duplicates
    if (!keyField) {
      return unionWith([...ours], theirs, isEqual)
    }

    // Special case for array position
    if (keyField === '<array>') {
      return this.mergeByPosition(ancestor, ours, theirs)
    }

    // Merge using key field
    return this.mergeByKeyField(ancestor, ours, theirs, keyField)
  }

  /**
   * Merges arrays by position
   */
  private mergeByPosition(
    ancestor: JsonArray,
    ours: JsonArray,
    theirs: JsonArray
  ): JsonArray {
    const result = [...ours]

    // Merge items at the same positions
    for (let i = 0; i < Math.min(ours.length, theirs.length); i++) {
      const ancestorItem = i < ancestor.length ? ancestor[i] : undefined

      // If they changed it from ancestor but we didn't, use their version
      if (!isEqual(theirs[i], ancestorItem) && isEqual(ours[i], ancestorItem)) {
        result[i] = theirs[i]
      }
    }

    // Add items that only exist in their version
    if (theirs.length > ours.length) {
      for (let i = ours.length; i < theirs.length; i++) {
        result.push(theirs[i])
      }
    }

    return result
  }

  /**
   * Merges arrays using a key field
   */
  private mergeByKeyField(
    ancestor: JsonArray,
    ours: JsonArray,
    theirs: JsonArray,
    keyField: string
  ): JsonArray {
    const result = [...ours]
    const processed = new Set<string>()

    // Create maps for efficient lookups
    const ourMap = new Map<string, JsonValue>()
    const theirMap = new Map<string, JsonValue>()
    const ancestorMap = new Map<string, JsonValue>()

    // Populate maps
    for (const item of ours) {
      const key = this.getItemKey(item, keyField)
      if (key) ourMap.set(key, item)
    }

    for (const item of theirs) {
      const key = this.getItemKey(item, keyField)
      if (key) theirMap.set(key, item)
    }

    for (const item of ancestor) {
      const key = this.getItemKey(item, keyField)
      if (key) ancestorMap.set(key, item)
    }

    // Process items in our version
    for (let i = 0; i < result.length; i++) {
      const key = this.getItemKey(result[i], keyField)
      if (!key) continue

      processed.add(key)

      // If item exists in both versions
      if (theirMap.has(key)) {
        const theirItem = theirMap.get(key)!
        const ancestorItem = ancestorMap.get(key)

        // If they changed it from ancestor but we didn't, use their version
        if (
          !isEqual(theirItem, ancestorItem) &&
          isEqual(result[i], ancestorItem)
        ) {
          result[i] = theirItem
        }
      }
    }

    // Add items that only exist in their version
    const uniqueTheirItems = differenceWith(
      Array.from(theirMap.values()),
      result,
      (a, b) => this.getItemKey(a, keyField) === this.getItemKey(b, keyField)
    )
    result.push(...uniqueTheirItems)

    return result
  }

  /**
   * Gets the key value for an item using the specified key field
   */
  private getItemKey(item: JsonValue, keyField: string): string | undefined {
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      keyField in item
    ) {
      return String(item[keyField])
    }
    return undefined
  }
}
