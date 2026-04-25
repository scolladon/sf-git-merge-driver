import type { Readable } from 'node:stream'
// txml has no first-party types — the runtime export is `parse(xml, options)`.
// @ts-expect-error: untyped, see TxmlAdapter doc-comment for the shape contract.
import { parse as txmlParse } from 'txml/dist/txml.mjs'
import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { NormalisedParseResult, XmlParser } from './XmlParser.js'

// tXml emits a DOM-like tree of TNode — different shape than the
// compact JsonObject the merger and writer expect. The adapter below
// converts on the fly. The mapping was derived from a spike comparing
// tXml's output to the previous parser's output across 16 representative
// XML cases (scalar, repeated, attrs, mixed content, comments, CDATA,
// namespaces, etc.).
interface TNode {
  readonly tagName: string
  readonly attributes: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<TNode | string>
}

const ATTR_PREFIX = '@_'
const TEXT_KEY = '#text'
const XMLNS_RE = /^xmlns(?::.+)?$/
// Matches a raw comment string emitted by tXml when keepComments=true.
// Body (the `[\s\S]*?` capture) is what we store under #xml__comment.
const COMMENT_RE = /^<!--([\s\S]*?)-->$/
// Sentinel tag we substitute for CDATA pre-tXml so the boundary survives.
// See preprocessCdata.
const CDATA_SENTINEL = '__cdata_sentinel__'
const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/g

// tXml unconditionally collapses CDATA content into the surrounding
// children as a plain text string — so by the time we see the parsed
// tree we can no longer tell `<v><![CDATA[<&>]]></v>` from `<v>&lt;&amp;&gt;</v>`.
// The writer DOES need to know the difference (it re-emits CDATA verbatim).
//
// Workaround: rewrite each CDATA region to a synthetic element BEFORE
// tXml sees the input. The element name is namespaced enough to never
// collide with real metadata. Inside, we entity-escape `<` and `&` so
// tXml accepts the wrapped content as valid PCDATA. The adapter (below)
// recognises the sentinel tag, undoes the escape, and emits the original
// content under the canonical CDATA key.
//
// `&` MUST be escaped first — otherwise `<` → `&lt;` would be re-escaped
// to `&amp;lt;` in a second pass.
const preprocessCdata = (xml: string): string =>
  xml.replace(CDATA_RE, (_, raw: string) => {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    return `<${CDATA_SENTINEL}>${escaped}</${CDATA_SENTINEL}>`
  })

const decodeCdataEscape = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&amp;/g, '&')

// tXml is permissive on malformed input: an unclosed tag like
// `<Profile><broken>` parses without complaint. The previous parser
// threw on the same input, and MergeDriver relies on the throw to
// surface a parse failure as a merge conflict.
//
// Restore that behaviour with a minimal well-formedness pass: walk the
// preprocessed XML once, track open-vs-close tag depth, throw on
// mismatch. CDATA sections have already been replaced by sentinel
// elements at this point so we don't need to skip them here.
const assertBalancedTags = (xml: string): void => {
  let depth = 0
  let i = 0
  while (i < xml.length) {
    const next = xml.indexOf('<', i)
    if (next < 0) break
    // <!-- comment -->: skip body
    if (xml.startsWith('<!--', next)) {
      const end = xml.indexOf('-->', next + 4)
      if (end < 0) throw new Error('XML parse error: unterminated comment')
      i = end + 3
      continue
    }
    // <?xml ... ?> declaration / processing instruction: skip body
    if (xml.startsWith('<?', next)) {
      const end = xml.indexOf('?>', next + 2)
      if (end < 0) throw new Error('XML parse error: unterminated <? ?>')
      i = end + 2
      continue
    }
    const tagEnd = xml.indexOf('>', next)
    if (tagEnd < 0) throw new Error('XML parse error: unterminated tag')
    const tagBody = xml.slice(next + 1, tagEnd)
    if (tagBody.startsWith('/')) {
      depth--
    } else if (!tagBody.endsWith('/')) {
      depth++
    }
    // self-closing `<x/>` does not change depth
    i = tagEnd + 1
  }
  if (depth !== 0) {
    throw new Error(
      `XML parse error: tags unbalanced (final depth ${depth.toString()})`
    )
  }
}

// Convert a TNode subtree into the compact JsonObject shape.
//
// Rules (each one anchored by a specific spike-probed case):
// - element with no children → ''                          (empty)
// - element with single text child → unbox to scalar       (scalar)
// - element with attrs + no other content → { '@_a': v }   (attr-only)
// - element with attrs + text → { '@_a': v, '#text': t }   (attrs+text)
// - repeated same-name siblings → grouped under one key as array
// - text + element siblings (mixed content) → text concatenated, stored
//   under '#text'; elements stored under their tags                 (mixed)
// - comments (when keepComments=true): raw `<!-- body -->` strings
//   in children → body extracted under '#xml__comment'              (comment)
// - CDATA (via the synthetic sentinel above) → '__cdata' key, multi-
//   segment becomes array                                            (cdata)
// - namespaces on the root element are extracted by the caller, NOT here
const toCompact = (node: TNode): JsonValue => {
  // Empty element (no children, no attrs)
  if (node.children.length === 0 && Object.keys(node.attributes).length === 0) {
    return ''
  }

  let textBuf = ''
  // Children grouped by tagName. Insertion order preserved for stable
  // round-tripping of the merger's per-key processing.
  const grouped = new Map<string, JsonValue[]>()
  const pushGrouped = (tag: string, value: JsonValue): void => {
    const existing = grouped.get(tag)
    if (existing) {
      existing.push(value)
    } else {
      grouped.set(tag, [value])
    }
  }

  for (const child of node.children) {
    if (typeof child === 'string') {
      // Comment (only present if keepComments=true was passed — which
      // we always pass to keep parity with the previous parser).
      const commentMatch = child.match(COMMENT_RE)
      if (commentMatch !== null) {
        // commentMatch[1] is the [\s\S]*? capture — always defined here
        // (even an empty `<!---->` matches with body = '').
        pushGrouped(XML_COMMENT_PROP_NAME, commentMatch[1]!)
        continue
      }
      textBuf += child
      continue
    }
    if (child.tagName === CDATA_SENTINEL) {
      // The sentinel was emitted by preprocessCdata as
      // `<__cdata_sentinel__>...escaped text...</__cdata_sentinel__>`
      // — its children are always exactly one PCDATA string by
      // construction; tXml may keep that as a single child or split it
      // across multiple text events depending on chunking. Either way
      // every child is a string here, so the join is unconditional.
      pushGrouped(
        CDATA_PROP_NAME,
        decodeCdataEscape((child.children as string[]).join(''))
      )
      continue
    }
    pushGrouped(child.tagName, toCompact(child))
  }

  // Build the output object. Attributes first (matches the previous
  // parser's emission order, which the writer relies on).
  const out: JsonObject = {}
  for (const [k, v] of Object.entries(node.attributes)) {
    out[`${ATTR_PREFIX}${k}`] = v
  }
  for (const [tag, arr] of grouped) {
    out[tag] = arr.length === 1 ? (arr[0] as JsonValue) : arr
  }
  // Whitespace-only text between elements is dropped to match the
  // previous parser; meaningful text is preserved.
  if (textBuf.trim().length > 0) {
    out[TEXT_KEY] = textBuf
  }

  // Single-text-child unbox: <v>1</v> should serialise as the scalar
  // "1", not { '#text': '1' }. Triggered when there are no attrs, no
  // child elements, and the only payload is the #text we just added.
  const keys = Object.keys(out)
  if (keys.length === 1 && keys[0] === TEXT_KEY) {
    return out[TEXT_KEY]!
  }
  // Empty body but had attrs (already handled the no-children-no-attrs
  // case above) — emit { '@_a': v, '#text': '' } to match the previous
  // parser's "explicit empty text" shape for attr-only elements.
  if (node.children.length === 0 && Object.keys(node.attributes).length > 0) {
    out[TEXT_KEY] = ''
  }
  return out
}

// Strip the `<?xml ?>` declaration TNode (if present) and pick the root
// element. tXml emits at most one `?xml` TNode and exactly one root
// element for any well-formed document.
const findRootElement = (
  topLevel: ReadonlyArray<TNode | string>
): TNode | undefined => {
  for (const n of topLevel) {
    if (typeof n === 'string') continue
    if (n.tagName === '?xml') continue
    return n
  }
  return undefined
}

// Split root attributes into (xmlns* → namespaces bucket) and (rest →
// stays on the element). Mirrors NormalisingOutputBuilder.addAttribute.
const splitRootAttrs = (
  root: TNode
): { rootAttrs: Record<string, string>; namespaces: JsonObject } => {
  const rootAttrs: Record<string, string> = {}
  const namespaces: JsonObject = {}
  for (const [k, v] of Object.entries(root.attributes)) {
    if (XMLNS_RE.test(k)) {
      namespaces[`${ATTR_PREFIX}${k}`] = v
    } else {
      rootAttrs[k] = v
    }
  }
  return { rootAttrs, namespaces }
}

const adapt = (xml: string): NormalisedParseResult => {
  const preprocessed = preprocessCdata(xml)
  assertBalancedTags(preprocessed)
  const top = txmlParse(preprocessed, {
    keepComments: true,
  }) as ReadonlyArray<TNode | string>
  const root = findRootElement(top)
  if (root === undefined) {
    return { content: {}, namespaces: {} }
  }
  const { rootAttrs, namespaces } = splitRootAttrs(root)
  const stripped: TNode = {
    tagName: root.tagName,
    attributes: rootAttrs,
    children: root.children,
  }
  const body = toCompact(stripped)
  return { content: { [root.tagName]: body }, namespaces }
}

const collectStream = async (source: Readable): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const c of source) {
    chunks.push(typeof c === 'string' ? Buffer.from(c, 'utf8') : (c as Buffer))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export class TxmlXmlParser implements XmlParser {
  parseString(xml: string): NormalisedParseResult {
    return adapt(xml)
  }

  async parseStream(source: Readable): Promise<NormalisedParseResult> {
    return adapt(await collectStream(source))
  }
}
