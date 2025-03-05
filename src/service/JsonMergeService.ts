export class JsonMergeService {
  // Deep merge function for objects
  mergeObjects(ancestor, ours, theirs) {
    // If types don't match, prefer our version
    if (
      typeof ours !== typeof theirs ||
      Array.isArray(ours) !== Array.isArray(theirs)
    ) {
      return ours
    }

    // Handle arrays - special case for Salesforce metadata
    if (Array.isArray(ours)) {
      return this.mergeArrays(ancestor, ours, theirs)
    }

    // Handle objects
    if (typeof ours === 'object' && ours !== null) {
      const result = { ...ours }

      // Process all keys from both objects
      const allKeys = new Set([
        ...Object.keys(ours || {}),
        ...Object.keys(theirs || {}),
      ])

      for (const key of allKeys) {
        // If key exists only in theirs, add it
        if (!(key in ours)) {
          result[key] = theirs[key]
          continue
        }

        // If key exists only in ours, keep it
        if (!(key in theirs)) {
          continue
        }

        // If key exists in both, recursively merge
        const ancestorValue = ancestor && ancestor[key]
        result[key] = this.mergeObjects(ancestorValue, ours[key], theirs[key])
      }

      return result
    }

    // For primitive values, check if they changed from ancestor
    if (theirs !== ancestor && ours === ancestor) {
      // They changed it, we didn't - use their change
      return theirs
    }

    // In all other cases, prefer our version
    return ours
  }

  // Special handling for Salesforce metadata arrays
  mergeArrays(ancestor, ours, theirs) {
    // For Salesforce metadata, arrays often contain objects with unique identifiers
    // Try to match items by common identifier fields
    const idFields = ['fullName', 'name', 'field', 'label', 'id', '@_name']

    // Find a common identifier field that exists in the arrays
    const idField = idFields.find(
      field =>
        ours.some(item => item && typeof item === 'object' && field in item) &&
        theirs.some(item => item && typeof item === 'object' && field in item)
    )

    if (idField) {
      // If we found a common identifier, merge by that field
      const result = [...ours]

      // Create maps for faster lookups
      const ourMap = new Map(
        ours
          .filter(item => item && typeof item === 'object' && idField in item)
          .map(item => [item[idField], item])
      )

      const ancestorMap =
        ancestor && Array.isArray(ancestor)
          ? new Map(
              ancestor
                .filter(
                  item => item && typeof item === 'object' && idField in item
                )
                .map(item => [item[idField], item])
            )
          : new Map()

      // Process items from their version
      for (const theirItem of theirs) {
        if (
          theirItem &&
          typeof theirItem === 'object' &&
          idField in theirItem
        ) {
          const id = theirItem[idField]

          if (ourMap.has(id)) {
            // Item exists in both versions, merge them
            const ourItem = ourMap.get(id)
            const ancestorItem = ancestorMap.get(id)

            // Find the index in our array
            const index = result.findIndex(
              item => item && typeof item === 'object' && item[idField] === id
            )

            if (index !== -1) {
              // Replace with merged item
              result[index] = this.mergeObjects(
                ancestorItem,
                ourItem,
                theirItem
              )
            }
          } else {
            // Item only exists in their version, add it
            result.push(theirItem)
          }
        }
      }

      return result
    }

    // If no common identifier found, default to our version
    return ours
  }
}
