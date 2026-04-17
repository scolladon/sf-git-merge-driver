import Builder, { type XMLBuilder } from 'fast-xml-builder'
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
import { pushAll } from '../utils/arrayUtils.js'
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

  // Explicit push-loop variant of the previous `keys.flatMap(...)` approach.
  // The flatMap form allocated an intermediate array per key (and a
  // single-element wrapper array when the callback returned a non-array),
  // which adds up to thousands of extra allocations on large profiles.
  // Using pushAll + a single output array per call halves the garbage the
  // serializer generates at the expense of a little extra indentation.
  //
  // All call sites (convertItem, serialize) narrow via isObj before calling
  // in, so input is always a JsonObject — no JsonArray branch needed.
  const compactToOrdered = (input: JsonObject): JsonArray => {
    const keys = Object.keys(input).sort()
    const out: JsonArray = []
    for (const attribute of keys) {
      const value = input[attribute]

      if (Array.isArray(value)) {
        const children: JsonArray = []
        for (const item of value) {
          pushAll(children, convertItem(item))
        }
        out.push({ [attribute]: children })
        continue
      }

      if (isObj(value)) {
        if (isConflictBlock(value)) {
          pushAll(out, expandConflict(value))
        } else {
          out.push({ [attribute]: compactToOrdered(value) })
        }
        continue
      }

      out.push(wrapText(value, attribute))
    }
    return out
  }

  return compactToOrdered
}

// ============================================================================
// Namespace + Post-processing
// ============================================================================

const insertNamespaces = (
  output: JsonArray,
  namespaces: JsonObject
): JsonArray => {
  if (Object.keys(namespaces).length === 0 || output.length === 0) return output
  const [first, ...rest] = output
  return [
    { ...(first as JsonObject), [NAMESPACE_ROOT]: { ...namespaces } },
    ...rest,
  ]
}

// XMLBuilder's format:true inserts `\n + indentation` before comments.
// Salesforce metadata uses inline comments — strip only builder-added
// newlines+indentation before each comment, not horizontal whitespace within
// a line. Previously the trailing `\n?\s*` group consumed the leading
// whitespace of the next element which caused consecutive comments to be
// silently concatenated; by only consuming the leading whitespace we keep
// the regex pure and the `g` flag handles back-to-back comments correctly.
const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\n\s*(<!--.*?-->)/g, '$1') : xml

// ============================================================================
// Serializer
// ============================================================================

export class FxpXmlSerializer implements XmlSerializer {
  private readonly formatter: ConflictMarkerFormatter
  private readonly convert: (input: JsonObject) => JsonArray
  private readonly builder: XMLBuilder

  constructor(config: MergeConfig) {
    this.formatter = new ConflictMarkerFormatter(config)
    this.convert = createConverter(config)
    this.builder = new Builder(builderOptions)
  }

  serialize(mergedOutput: JsonArray, namespaces: JsonObject): string {
    const ordered = mergedOutput.flatMap((item: JsonValue) =>
      isObj(item) ? this.convert(item) : [{ [TEXT_TAG]: item }]
    )
    const withNamespaces = insertNamespaces(ordered, namespaces)

    const xml: string = this.builder.build(withNamespaces)

    let result = XML_DECL.concat(xml)
    result = this.formatter.handleSpecialEntities(result)
    result = correctComments(result)
    result = this.formatter.correctConflictIndent(result)
    return result
  }
}
