import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { TraceSyncMethod } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n'
const XML_COMMENT_PROP_NAME = '#xml__comment'

const baseOptions = {
  cdataPropName: '__cdata',
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
  // preserveOrder: true,
}

const builderOptions = {
  ...baseOptions,
  format: true,
  indentBy: '    ',
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

export class XmlMerger {
  @TraceSyncMethod
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
    const jsonMerger = new JsonMerger()
    const mergedResult = jsonMerger.mergeThreeWay(ancestorObj, ourObj, theirObj)

    // Convert back to XML and format
    const builder = new XMLBuilder(builderOptions)
    const mergedXml: string = builder.build(mergedResult.output)
    return {
      output: mergedXml.length
        ? correctConflictIndent(
            correctComments(XML_DECL.concat(handleSpecialEntities(mergedXml)))
          )
        : '',
      hasConflict: mergedResult.hasConflict,
    }
  }
}
