import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { JsonMerger } from './JsonMerger.js'

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n'
const XML_COMMENT_PROP_NAME = '#xml__comment'

const parserOptions = {
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '__cdata',
  ignoreDeclaration: true,
  numberParseOptions: { leadingZeros: false, hex: false },
  commentPropName: XML_COMMENT_PROP_NAME,
}

const builderOptions = {
  format: true,
  indentBy: '    ',
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  commentPropName: XML_COMMENT_PROP_NAME,
}

const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml

const handleSpecialEntities = (xml: string): string =>
  xml.replaceAll('&amp;#160;', '&#160;')

export class XmlMerger {
  tripartXmlMerge(
    ancestorContent: string,
    ourContent: string,
    theirContent: string
  ) {
    const parser = new XMLParser(parserOptions)

    const ancestorObj = parser.parse(ancestorContent)
    const ourObj = parser.parse(ourContent)
    const theirObj = parser.parse(theirContent)

    // Perform deep merge of XML objects

    const jsonMerger = new JsonMerger()
    const mergedObj = jsonMerger.mergeObjects(ancestorObj, ourObj, theirObj)

    // Convert back to XML and format
    const builder = new XMLBuilder(builderOptions)
    const mergedXml = builder.build(mergedObj)
    return correctComments(XML_DECL.concat(handleSpecialEntities(mergedXml)))
  }
}
