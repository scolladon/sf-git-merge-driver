import type { Readable } from 'node:stream'
import type { JsonObject } from '../types/jsonTypes.js'

export interface NormalisedParseResult {
  readonly content: JsonObject
  readonly namespaces: JsonObject
}

export interface XmlParser {
  parseString(xml: string): NormalisedParseResult
  parseStream(source: Readable): Promise<NormalisedParseResult>
}
