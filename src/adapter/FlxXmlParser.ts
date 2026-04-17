import FlxParser, { type X2jOptions } from '@nodable/flexible-xml-parser'
import {
  CDATA_PROP_NAME,
  NAMESPACE_PREFIX,
  XML_COMMENT_PROP_NAME,
} from '../constant/parserConstant.js'
import type { JsonObject } from '../types/jsonTypes.js'
import type { ParsedXml, XmlParser } from './XmlParser.js'

// valueParsers works at runtime on the output builder but is missing from X2jOptions
const flxOptions = {
  skip: { attributes: false, declaration: true },
  tags: { valueParsers: [] },
  attributes: { valueParsers: [] },
  nameFor: { cdata: CDATA_PROP_NAME, comment: XML_COMMENT_PROP_NAME },
  doctypeOptions: { enabled: false, maxEntityCount: 100, maxEntitySize: 10000 },
} as X2jOptions

// Parser guarantees every root child is an object (see parse-output tests),
// so we don't need to defensively handle primitives/arrays at this level.
const stripDeclarationArtifacts = (root: JsonObject): JsonObject => {
  const cleaned: JsonObject = {}
  for (const key of Object.keys(root)) {
    const child = root[key] as JsonObject
    const childCleaned: JsonObject = {}
    for (const childKey of Object.keys(child)) {
      if (childKey === '@_version' || childKey === '@_encoding') continue
      childCleaned[childKey] = child[childKey]
    }
    cleaned[key] = childCleaned
  }
  return cleaned
}

const hasEmptyCdataText = (node: JsonObject): boolean =>
  CDATA_PROP_NAME in node && '#text' in node && node['#text'] === ''

const pruneEmptyCdataText = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(pruneEmptyCdataText)
  const obj = value as JsonObject
  const out: JsonObject = {}
  for (const key of Object.keys(obj)) {
    if (hasEmptyCdataText(obj) && key === '#text') continue
    out[key] = pruneEmptyCdataText(obj[key]) as JsonObject[string]
  }
  return out
}

const extractNamespaces = (
  parsed: JsonObject
): { content: JsonObject; namespaces: JsonObject } => {
  const namespaces: JsonObject = {}
  const content: JsonObject = {}
  for (const key of Object.keys(parsed)) {
    const childObj = parsed[key] as JsonObject
    const cleanedChild: JsonObject = {}
    for (const childKey of Object.keys(childObj)) {
      if (childKey.startsWith(NAMESPACE_PREFIX)) {
        namespaces[childKey] = childObj[childKey]
      } else {
        cleanedChild[childKey] = childObj[childKey]
      }
    }
    content[key] = cleanedChild
  }
  return { content, namespaces }
}

export class FlxXmlParser implements XmlParser {
  private readonly parser = new FlxParser(flxOptions)

  parse(xml: string): ParsedXml {
    const raw = this.parser.parse(xml) as JsonObject
    const afterDeclaration = stripDeclarationArtifacts(raw)
    const afterCdataPrune = pruneEmptyCdataText(afterDeclaration) as JsonObject
    return extractNamespaces(afterCdataPrune)
  }
}
