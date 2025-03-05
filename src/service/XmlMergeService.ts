import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { JsonMergeService } from './JsonMergeService.js'

const options = {
  attributeNamePrefix: '@_',
  commentPropName: '#comment',
  format: true,
  ignoreAttributes: false,
  ignoreNameSpace: false,
  indentBy: '    ',
  parseAttributeValue: false,
  parseNodeValue: false,
  parseTagValue: false,
  processEntities: false,
  suppressEmptyNode: false,
  trimValues: true,
}

export class XmlMergeService {
  async tripartXmlMerge(
    ancestorContent: string,
    ourContent: string,
    theirContent: string
  ) {
    const parser = new XMLParser(options)

    const ancestorObj = parser.parse(ancestorContent)
    const ourObj = parser.parse(ourContent)
    const theirObj = parser.parse(theirContent)

    // Perform deep merge of XML objects

    const jsonMergeService = new JsonMergeService()
    const mergedObj = jsonMergeService.mergeObjects(
      ancestorObj,
      ourObj,
      theirObj
    )

    // Convert back to XML and format
    const builder = new XMLBuilder(options)
    const mergedXml = builder.build(mergedObj)
    return mergedXml
  }
}
