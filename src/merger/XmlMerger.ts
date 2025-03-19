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
  // preserveOrder: true,
}

const builderOptions = {
  format: true,
  indentBy: '    ',
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  commentPropName: XML_COMMENT_PROP_NAME,
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
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')

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
    // console.log('ancestorObj')
    // console.dir(ancestorObj, {depth:null})

    // Perform deep merge of XML objects

    const jsonMerger = new JsonMerger()
    const mergedObj = jsonMerger.mergeObjects(ancestorObj, ourObj, theirObj)
    // console.log('mergedObj')
    // console.dir(mergedObj, {depth:null})

    // Convert back to XML and format
    const builder = new XMLBuilder(builderOptions)
    const mergedXml = builder.build(mergedObj)
    // console.log('mergedXml')
    // console.dir(mergedXml, {depth:null})
    return correctConflictIndent(
      correctComments(XML_DECL.concat(handleSpecialEntities(mergedXml)))
    )
  }
}
