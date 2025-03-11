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
  private readonly idFields = [
    'fullName',
    'name',
    'field',
    'label',
    'id',
    '@_name',
  ]

  mergeObjects(
    ancestor: JsonValue | undefined,
    ours: JsonValue,
    theirs: JsonValue
  ): JsonValue {
    // Handle null/undefined cases
    if (ours === null || theirs === null) return ours ?? theirs
    if (typeof ours !== typeof theirs) return ours

    // Handle arrays (special case for Salesforce metadata)
    if (Array.isArray(ours) && Array.isArray(theirs)) {
      return this.mergeArrays(
        Array.isArray(ancestor) ? ancestor : undefined,
        ours,
        theirs
      )
    }

    // Handle objects
    if (typeof ours === 'object' && typeof theirs === 'object') {
      const result = { ...ours } as JsonObject
      const ancestorObj = (ancestor ?? {}) as JsonObject
      const theirsObj = theirs as JsonObject

      // Process all keys from both objects
      const allKeys = new Set([...Object.keys(ours), ...Object.keys(theirs)])

      for (const key of allKeys) {
        if (!(key in theirsObj)) continue // Keep our version
        if (!(key in result)) {
          result[key] = theirsObj[key] // Take their version
          continue
        }

        // Recursively merge when both have the key
        result[key] = this.mergeObjects(
          ancestorObj[key],
          result[key],
          theirsObj[key]
        )
      }
      return result
    }

    // For primitive values, use their changes if we didn't modify from ancestor
    if (theirs !== ancestor && ours === ancestor) return theirs
    return ours // Default to our version
  }

  private mergeArrays(
    ancestor: JsonArray | undefined,
    ours: JsonArray,
    theirs: JsonArray
  ): JsonArray {
    // Find the first matching ID field that exists in both arrays
    const idField = this.idFields.find(
      field =>
        ours.some(item => this.hasIdField(item, field)) &&
        theirs.some(item => this.hasIdField(item, field))
    )

    if (!idField) return ours // No common identifier, keep our version

    // Create lookup maps
    const ourMap = this.createIdMap(ours, idField)
    const theirMap = this.createIdMap(theirs, idField)
    const ancestorMap = ancestor
      ? this.createIdMap(ancestor, idField)
      : new Map()

    const result = [...ours]
    const processed = new Set<string>()

    // Process all items from both arrays
    for (const [id, ourItem] of ourMap) {
      const theirItem = theirMap.get(id)
      if (theirItem) {
        // Item exists in both versions, merge them
        const index = result.findIndex(
          item => this.hasIdField(item, idField) && item[idField] === id
        )
        if (index !== -1) {
          result[index] = this.mergeObjects(
            ancestorMap.get(id),
            ourItem,
            theirItem
          )
        }
      }
      processed.add(id)
    }

    // Add items that only exist in their version
    for (const [id, theirItem] of theirMap) {
      if (!processed.has(id)) {
        result.push(theirItem)
      }
    }

    return result
  }

  private hasIdField(item: JsonValue, field: string): item is JsonObject {
    return (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      field in item
    )
  }

  private createIdMap(
    arr: JsonArray,
    idField: string
  ): Map<string, JsonObject> {
    return new Map(
      arr
        .filter(item => this.hasIdField(item, idField))
        .map(item => [String(item[idField]), item])
    )
  }
}
