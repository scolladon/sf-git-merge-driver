import { XMLBuilder } from 'fast-xml-parser'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../constant/metadataConstant.js'
import {
  CDATA_PROP_NAME,
  NAMESPACE_ROOT,
  TEXT_TAG,
  XML_COMMENT_PROP_NAME,
  XML_DECL,
  XML_INDENT,
} from '../constant/parserConstant.js'
import { ConflictMarkerFormatter } from '../merger/ConflictMarkerFormatter.js'
import { type ConflictBlock, isConflictBlock } from '../types/conflictBlock.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { XmlSerializer } from './XmlSerializer.js'

const builderOptions = {
  cdataPropName: CDATA_PROP_NAME,
  commentPropName: XML_COMMENT_PROP_NAME,
  ignoreAttributes: false,
  processEntities: false,
  format: true,
  indentBy: XML_INDENT,
  preserveOrder: true,
}

// ============================================================================
// Compact → Ordered Format Converter (created per-serialization with config)
// ============================================================================

const isObj = (x: unknown): x is JsonObject =>
  typeof x === 'object' && x !== null

const createConverter = (config: MergeConfig) => {
  const wrapText = (value: JsonValue, attribute: string): JsonObject =>
    value == null ? {} : { [attribute]: [{ [TEXT_TAG]: value }] }

  const expandConflictContent = (content: JsonArray): JsonArray => {
    if (content.length === 0) return [{ [TEXT_TAG]: SALESFORCE_EOL }]
    return content.flatMap((item: JsonValue) => {
      if (isConflictBlock(item)) return expandConflict(item)
      if (isObj(item)) return compactToOrdered(item)
      return { [TEXT_TAG]: item }
    })
  }

  const expandConflict = (block: ConflictBlock): JsonArray => {
    const localMarker = `${SALESFORCE_EOL}${LOCAL_CONFLICT_MARKER.repeat(config.conflictMarkerSize)} ${config.localConflictTag}`
    const baseMarker = `${ANCESTOR_CONFLICT_MARKER.repeat(config.conflictMarkerSize)} ${config.ancestorConflictTag}`
    const separator = SEPARATOR.repeat(config.conflictMarkerSize)
    const otherMarker = `${OTHER_CONFLICT_MARKER.repeat(config.conflictMarkerSize)} ${config.otherConflictTag}`

    return [
      { [TEXT_TAG]: localMarker },
      ...expandConflictContent(block.local as JsonArray),
      { [TEXT_TAG]: baseMarker },
      ...expandConflictContent(block.ancestor as JsonArray),
      { [TEXT_TAG]: separator },
      ...expandConflictContent(block.other as JsonArray),
      { [TEXT_TAG]: otherMarker },
    ]
  }

  const convertItem = (item: JsonValue): JsonArray => {
    if (isConflictBlock(item)) return expandConflict(item)
    if (isObj(item)) return compactToOrdered(item)
    return [{ [TEXT_TAG]: item }]
  }

  const compactToOrdered = (input: JsonObject | JsonArray): JsonArray => {
    const keys = Object.keys(input).sort()
    return keys.flatMap(attribute => {
      const value = input[attribute]

      if (Array.isArray(value)) {
        const children = value.flatMap(convertItem)
        return { [attribute]: children }
      }

      if (isObj(value)) {
        if (isConflictBlock(value)) return expandConflict(value)
        return { [attribute]: compactToOrdered(value) }
      }

      return wrapText(value, attribute)
    })
  }

  return compactToOrdered
}

// ============================================================================
// Namespace + Post-processing
// ============================================================================

const insertNamespaces = (output: JsonArray, namespaces: JsonObject): void => {
  if (Object.keys(namespaces).length === 0 || output.length === 0) return
  const root = output[0] as JsonObject
  root[NAMESPACE_ROOT] = { ...namespaces }
}

const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml

// ============================================================================
// Serializer
// ============================================================================

export class FxpXmlSerializer implements XmlSerializer {
  private readonly formatter: ConflictMarkerFormatter
  private readonly convert: (input: JsonObject | JsonArray) => JsonArray
  private readonly builder: XMLBuilder

  constructor(config: MergeConfig) {
    this.formatter = new ConflictMarkerFormatter(config)
    this.convert = createConverter(config)
    this.builder = new XMLBuilder(builderOptions)
  }

  serialize(mergedOutput: JsonArray, namespaces: JsonObject): string {
    const ordered = mergedOutput.flatMap((item: JsonValue) =>
      isObj(item) ? this.convert(item) : [{ [TEXT_TAG]: item }]
    )
    insertNamespaces(ordered, namespaces)

    const xml: string = this.builder.build(ordered)

    let result = XML_DECL.concat(xml)
    result = this.formatter.handleSpecialEntities(result)
    result = correctComments(result)
    result = this.formatter.correctConflictIndent(result)
    return result
  }
}
