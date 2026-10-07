import type { Readable } from 'node:stream'
import type { JsonObject } from '../types/jsonTypes.js'

export interface NormalisedParseResult {
  readonly content: JsonObject
  // Every attribute of the document root, `@_`-prefixed and in source order:
  // the xmlns* declarations and any other (e.g. `xsi:schemaLocation`). They
  // are kept out of `content` so the merge never decomposes them.
  readonly namespaces: JsonObject
}

export interface XmlParser {
  parseString(xml: string): NormalisedParseResult
  parseStream(source: Readable): Promise<NormalisedParseResult>
}
