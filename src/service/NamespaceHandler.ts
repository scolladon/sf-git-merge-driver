import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { TraceSyncMethod } from '../utils/LoggingDecorator.js'

const NAMESPACE_PREFIX = '@_'
const NAMESPACE_ROOT = ':@'

export class NamespaceHandler {
  @TraceSyncMethod
  public processNamespaces(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): JsonObject {
    const namespaces: JsonObject = {}

    // Look for namespace attributes directly at the root level
    for (const obj of [ancestor, local, other]) {
      for (const key of Object.keys(obj)) {
        // It's an object, check for namespace attributes and remove them
        const childObj = obj[key] as JsonObject
        for (const childKey of Object.keys(childObj)) {
          if (childKey.startsWith(NAMESPACE_PREFIX)) {
            namespaces[childKey] = childObj[childKey]
            delete childObj[childKey] // Remove namespace attribute after extraction
          }
        }
      }
    }

    return namespaces
  }

  @TraceSyncMethod
  public addNamespacesToResult(acc: JsonArray, namespaces: JsonObject): void {
    if (Object.keys(namespaces).length > 0 && acc.length > 0) {
      // Create a root object if needed
      const rootObject = acc[0] as JsonObject

      // The namespace should be at the top level in the result
      rootObject[NAMESPACE_ROOT] = {}

      // Add each namespace as a child of the root's :@ property
      for (const key of Object.keys(namespaces)) {
        ;(rootObject[NAMESPACE_ROOT] as JsonObject)[key] = namespaces[key]
      }
    }
  }
}
