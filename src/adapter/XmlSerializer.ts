import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

export interface XmlSerializer {
  serialize(mergedOutput: JsonArray, namespaces: JsonObject): string
}
