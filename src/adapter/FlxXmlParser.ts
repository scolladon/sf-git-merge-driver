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
  doctypeOptions: { enabled: false },
} as X2jOptions

const hasEmptyCdataText = (node: JsonObject): boolean =>
  CDATA_PROP_NAME in node && '#text' in node && node['#text'] === ''

// Single recursive pass that:
//   - strips `@_version`/`@_encoding` (XML-declaration attributes that some
//     parser builds leak onto element nodes) at every depth — defensive
//     coverage that matches the original in-place `cleanParserBugs` walk;
//   - drops empty `#text` siblings of a CDATA block (parser quirk).
// Computing both conditions in one walk halves the parse-time tree-rebuild
// cost vs. doing them in two separate passes.
const normalizeParsed = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(normalizeParsed)
  const obj = value as JsonObject
  const dropEmptyText = hasEmptyCdataText(obj)
  const out: JsonObject = {}
  for (const key of Object.keys(obj)) {
    if (key === '@_version' || key === '@_encoding') continue
    if (dropEmptyText && key === '#text') continue
    out[key] = normalizeParsed(obj[key]) as JsonObject[string]
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
    const normalized = normalizeParsed(raw) as JsonObject
    return extractNamespaces(normalized)
  }
}
