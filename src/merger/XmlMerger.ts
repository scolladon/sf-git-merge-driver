import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
  XML_DECL,
  XML_INDENT,
} from '../constant/parserConstant.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const baseOptions = {
  cdataPropName: CDATA_PROP_NAME,
  commentPropName: XML_COMMENT_PROP_NAME,
  ignoreAttributes: false,
  processEntities: false,
}

const parserOptions = {
  ...baseOptions,
  ignoreDeclaration: true,
  numberParseOptions: { leadingZeros: false, hex: false },
  parseAttributeValue: false,
  parseTagValue: false,
}

const builderOptions = {
  ...baseOptions,
  format: true,
  indentBy: XML_INDENT,
  preserveOrder: true,
}

const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml

const correctConflictIndent = (xml: string): string =>
  xml
    .replace(/[ \t]+(<<<<<<<|\|\|\|\|\|\|\||=======|>>>>>>>)/g, '$1')
    .replace(/^[ \t]*[\n\r]+/gm, '')

const handleSpecialEntities = (xml: string): string =>
  xml
    .replaceAll('&amp;#160;', '&#160;')
    .replaceAll('&lt;&lt;&lt;&lt;&lt;&lt;&lt;', '<<<<<<<')
    .replaceAll('&gt;&gt;&gt;&gt;&gt;&gt;&gt;', '>>>>>>>')

const pipe =
  (...fns: ((xml: string) => string)[]) =>
  (input: string): string =>
    fns.reduce((acc, fn) => fn(acc), input)

const formatXmlOutput = pipe(
  (xml: string) => XML_DECL.concat(xml),
  handleSpecialEntities,
  correctComments,
  correctConflictIndent
)

export class XmlMerger {
  constructor(private readonly config: MergeConfig) {}

  @log
  mergeThreeWay(
    ancestorContent: string,
    ourContent: string,
    theirContent: string
  ): { output: string; hasConflict: boolean } {
    const parser = new XMLParser(parserOptions)

    const ancestorObj = parser.parse(ancestorContent)
    const ourObj = parser.parse(ourContent)
    const theirObj = parser.parse(theirContent)

    // Perform deep merge of XML objects
    const jsonMerger = new JsonMerger(this.config)
    const mergedResult = jsonMerger.mergeThreeWay(ancestorObj, ourObj, theirObj)

    // Convert back to XML and format
    const builder = new XMLBuilder(builderOptions)
    const mergedXml: string = builder.build(mergedResult.output)
    return {
      output: mergedXml.length ? formatXmlOutput(mergedXml) : '',
      hasConflict: mergedResult.hasConflict,
    }
  }
}
