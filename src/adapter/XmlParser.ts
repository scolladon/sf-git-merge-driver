import type { JsonObject } from '../types/jsonTypes.js'

export interface ParsedXml {
  readonly content: JsonObject
  readonly namespaces: JsonObject
}

export interface XmlParser {
  parse(xml: string): ParsedXml
}
