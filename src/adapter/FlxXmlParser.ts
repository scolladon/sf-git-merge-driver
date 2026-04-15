import FlxParser, { type X2jOptions } from '@nodable/flexible-xml-parser'
import {
  CDATA_PROP_NAME,
  NAMESPACE_PREFIX,
  XML_COMMENT_PROP_NAME,
} from '../constant/parserConstant.js'
import type { JsonObject } from '../types/jsonTypes.js'
import type { ParsedXml, XmlParser } from './XmlParser.js'

// valueParsers works at runtime but is missing from the type definitions
const flxOptions = {
  skip: { attributes: false, declaration: true },
  tags: { valueParsers: [] },
  attributes: { valueParsers: [] },
  nameFor: { cdata: CDATA_PROP_NAME, comment: XML_COMMENT_PROP_NAME },
  entityParseOptions: { default: false },
} as X2jOptions

const cleanParserBugs = (record: Record<string, unknown>): void => {
  for (const key of Object.keys(record)) {
    const val = record[key]
    if (typeof val !== 'object' || val === null) continue
    const child = val as Record<string, unknown>
    delete child['@_version']
    delete child['@_encoding']
    if (CDATA_PROP_NAME in child && '#text' in child && child['#text'] === '') {
      delete child['#text']
    }
    cleanParserBugs(child)
  }
}

const extractNamespaces = (parsed: JsonObject): JsonObject => {
  const namespaces: JsonObject = {}
  for (const key of Object.keys(parsed)) {
    const childObj = parsed[key] as JsonObject
    for (const childKey of Object.keys(childObj)) {
      if (childKey.startsWith(NAMESPACE_PREFIX)) {
        namespaces[childKey] = childObj[childKey]
        delete childObj[childKey]
      }
    }
  }
  return namespaces
}

export class FlxXmlParser implements XmlParser {
  private readonly parser = new FlxParser(flxOptions)

  parse(xml: string): ParsedXml {
    const raw = this.parser.parse(xml) as JsonObject
    cleanParserBugs(raw as Record<string, unknown>)
    const namespaces = extractNamespaces(raw)
    return { content: raw, namespaces }
  }
}
