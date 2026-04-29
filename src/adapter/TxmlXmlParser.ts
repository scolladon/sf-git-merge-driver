import type { Readable } from 'node:stream'
// txml has no first-party types — declare a narrow ambient signature
// here instead of casting the import to `any`. The cast at the call
// site (line "const top = parsedToTNodes(...)") then narrows from
// `unknown`, not from `any`, so a future txml release that changes
// the return shape surfaces as a tsc error rather than silent runtime
// breakage. The @ts-expect-error covers only the missing-types
// resolution; the runtime contract is asserted in `parsedToTNodes`.
// @ts-expect-error: txml ships no .d.ts, declare-module is not picked
// up across .mjs subpath imports under our nodenext module resolution.
import { parse as txmlParseUntyped } from 'txml/dist/txml.mjs'
import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { NormalisedParseResult, XmlParser } from './XmlParser.js'

const txmlParse = txmlParseUntyped as (
  xml: string,
  opts?: { keepComments?: boolean }
) => unknown

// tXml emits a DOM-like tree of TNode — different shape than the
// compact JsonObject the merger and writer expect. The adapter below
// converts on the fly. The mapping was derived from a spike comparing
// tXml's output to the previous parser's output across 16 representative
// XML cases (scalar, repeated, attrs, mixed content, comments, CDATA,
// namespaces, etc.).
// Exported only for direct unit tests of the defensive helpers
// (`sentinelTextOf`, `parsedToTNodes`) — production code never
// constructs TNode literals; they come straight out of txml.
export interface TNode {
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
// Sentinel tag we substitute for CDATA pre-tXml so the boundary
// survives. Per the XML 1.0 spec, an element name's NameStartChar
// disallows ASCII control bytes — so `\x00` cannot appear in a real
// document's tag and the sentinel is collision-proof against
// adversarial inputs (a hand-authored profile containing
// `<__cdata_sentinel__>...` would otherwise have been silently
// converted into a fabricated CDATA node).
const CDATA_SENTINEL = '\x00cdata\x00'
const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/g

// tXml unconditionally collapses CDATA content into the surrounding
// children as a plain text string — so by the time we see the parsed
// tree we can no longer tell `<v><![CDATA[<&>]]></v>` from `<v>&lt;&amp;&gt;</v>`.
// The writer DOES need to know the difference (it re-emits CDATA verbatim).
//
// Workaround: rewrite each CDATA region to a synthetic element BEFORE
// tXml sees the input. Inside, we entity-escape `<` and `&` so tXml
// accepts the wrapped content as valid PCDATA. The adapter (below)
// recognises the sentinel tag, undoes the escape, and emits the
// original content under the canonical CDATA key.
//
// `&` MUST be escaped first — otherwise `<` → `&lt;` would be
// re-escaped to `&amp;lt;` in a second pass.
const preprocessCdata = (xml: string): string =>
  xml.replace(CDATA_RE, (_, raw: string) => {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    return `<${CDATA_SENTINEL}>${escaped}</${CDATA_SENTINEL}>`
  })

// Decode pairs the encode in preprocessCdata. The two patterns
// (`&lt;` and `&amp;`) are disjoint, so order is not load-bearing
// for the current set — BUT if a third escape is ever added it MUST
// be decoded last-encoded-first to avoid double-decoding (e.g. an
// `>` → `&gt;` extension would have to decode `&gt;` BEFORE `&amp;`).
const decodeCdataEscape = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&amp;/g, '&')

// Quote-aware scan for the next unescaped `>` that closes a tag
// starting at `from` (the position of the `<`). Walks past `>` chars
// that appear inside `"..."` or `'...'` attribute values. Without this
// guard, `<el attr="a>b">` would be split mid-attribute by a naive
// `indexOf('>')` and the resulting `tagBody` would falsely trigger
// the unbalanced-tags check on otherwise valid XML.
const findTagEnd = (xml: string, from: number): number => {
  let inQuote: '"' | "'" | null = null
  for (let i = from; i < xml.length; i++) {
    const ch = xml[i]
    if (inQuote !== null) {
      if (ch === inQuote) inQuote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch
      continue
    }
    if (ch === '>') return i
  }
  return -1
}

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
    // <!-- comment -->
    if (xml.startsWith('<!--', next)) {
      const end = xml.indexOf('-->', next + 4)
      if (end < 0) throw new Error('XML parse error: unterminated comment')
      i = end + 3
      continue
    }
    // <!DOCTYPE …>, <![CDATA[…]]> (already preprocessed away),
    // <!ENTITY …>, etc. None contribute to element nesting; skip the
    // whole declaration. Salesforce metadata never emits these but
    // defensive handling costs two lines and prevents a false
    // unbalanced-tags throw on any document with a DOCTYPE prologue.
    if (xml.startsWith('<!', next)) {
      const end = findTagEnd(xml, next + 2)
      if (end < 0) throw new Error('XML parse error: unterminated <! ... >')
      i = end + 1
      continue
    }
    // <?xml ... ?> declaration / processing instruction
    if (xml.startsWith('<?', next)) {
      const end = xml.indexOf('?>', next + 2)
      if (end < 0) throw new Error('XML parse error: unterminated <? ?>')
      i = end + 2
      continue
    }
    const tagEnd = findTagEnd(xml, next + 1)
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

// Output of the child-classification pass over a TNode's children.
// Text fragments accumulated into one buffer; element children grouped
// by tagName preserving insertion order so the merger's per-key
// processing stays stable.
interface ClassifiedChildren {
  readonly textBuf: string
  readonly grouped: ReadonlyMap<string, ReadonlyArray<JsonValue>>
}

// Walk a TNode's children once, separating text (concatenated) from
// element children (grouped by tagName). CDATA sentinels and comment
// strings are rewritten into their canonical compact-tree keys here.
const classifyChildren = (
  children: ReadonlyArray<TNode | string>
): ClassifiedChildren => {
  let textBuf = ''
  const grouped = new Map<string, JsonValue[]>()
  const push = (tag: string, value: JsonValue): void => {
    const existing = grouped.get(tag)
    if (existing) {
      existing.push(value)
    } else {
      grouped.set(tag, [value])
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      const commentMatch = child.match(COMMENT_RE)
      if (commentMatch !== null) {
        // commentMatch[1] is the [\s\S]*? capture — always defined here
        // (even an empty `<!---->` matches with body = '').
        push(XML_COMMENT_PROP_NAME, commentMatch[1]!)
        continue
      }
      textBuf += child
      continue
    }
    if (child.tagName === CDATA_SENTINEL) {
      push(CDATA_PROP_NAME, decodeCdataEscape(sentinelTextOf(child)))
      continue
    }
    push(child.tagName, toCompact(child))
  }
  return { textBuf, grouped }
}

// Extract the text payload of a CDATA-sentinel TNode. Filtered for
// `string` so a future txml release that introduces nested TNodes
// inside the sentinel (e.g. via entity expansion) does not silently
// stringify `[object Object]` into the CDATA content — the previous
// `as string[]` cast erased the discriminated-union check.
//
// Exported only so the defensive non-string branch can be exercised
// from a unit test (txml's real output for our preprocessed input
// always satisfies the all-strings precondition, so the guard is
// otherwise unreachable through a black-box parseString call).
export const sentinelTextOf = (node: TNode): string => {
  let out = ''
  for (const c of node.children) {
    if (typeof c === 'string') out += c
  }
  return out
}

// Single-text-child unbox: <v>1</v> serialises as the scalar "1", not
// `{ '#text': '1' }`. The previous parser's compact shape preferred
// the scalar form; the writer relies on it.
const unboxScalar = (out: JsonObject): JsonValue => {
  const keys = Object.keys(out)
  if (keys.length === 1 && keys[0] === TEXT_KEY) return out[TEXT_KEY]!
  return out
}

// Convert a TNode subtree into the compact JsonObject shape.
//
// Rules (each one anchored by a specific spike-probed case):
// - element with no children + no attrs   → ''                  (empty)
// - element with single text child        → unbox to scalar     (scalar)
// - element with attrs + no body          → { '@_a': v, '#text': '' }
// - element with attrs + text             → { '@_a': v, '#text': t }
// - repeated same-name siblings           → array under one key
// - mixed text + elements                 → text concatenated under '#text'
// - comments (when keepComments=true)     → '#xml__comment'
// - CDATA (via the synthetic sentinel)    → '__cdata' key, multi-segment as array
// - root-element xmlns attributes         → extracted by the caller, NOT here
const toCompact = (node: TNode): JsonValue => {
  const noChildren = node.children.length === 0
  const noAttrs = Object.keys(node.attributes).length === 0
  if (noChildren && noAttrs) return ''

  const { textBuf, grouped } = classifyChildren(node.children)

  // Attributes first matches the previous parser's emission order,
  // which the writer relies on for stable byte output.
  const out: JsonObject = {}
  for (const [k, v] of Object.entries(node.attributes)) {
    out[`${ATTR_PREFIX}${k}`] = v
  }
  for (const [tag, arr] of grouped) {
    out[tag] = arr.length === 1 ? (arr[0] as JsonValue) : (arr as JsonValue[])
  }
  // Whitespace-only text between elements is dropped (the previous
  // parser's behaviour); meaningful text is preserved.
  if (textBuf.trim().length > 0) out[TEXT_KEY] = textBuf

  // Attr-only element with empty body — emit explicit empty #text to
  // match the previous parser's shape ({ '@_a': v, '#text': '' }).
  if (noChildren && !noAttrs) out[TEXT_KEY] = ''

  return unboxScalar(out)
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
// stays on the element). Mirrors the previous parser's namespace
// extraction.
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

// Narrow txml's `unknown` return into the TNode shape we actually use.
// A future txml major release that breaks the shape contract surfaces
// here as a descriptive throw instead of a downstream undefined-access.
//
// Exported only so the throw branch can be exercised from a unit test;
// real txml output is always an array, so the guard is otherwise
// unreachable through a black-box parseString call.
export const parsedToTNodes = (raw: unknown): ReadonlyArray<TNode | string> => {
  if (!Array.isArray(raw)) {
    throw new Error(`txml.parse: expected an array of nodes, got ${typeof raw}`)
  }
  return raw as ReadonlyArray<TNode | string>
}

const adapt = (xml: string): NormalisedParseResult => {
  const preprocessed = preprocessCdata(xml)
  assertBalancedTags(preprocessed)
  const top = parsedToTNodes(txmlParse(preprocessed, { keepComments: true }))
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
  return {
    content: { [root.tagName]: toCompact(stripped) },
    namespaces,
  }
}

// Drain a Readable into a single UTF-8 string. The deliberate
// full-buffer approach matches the writer's: SF metadata files are
// KB-MB, and txml's parse API is synchronous, so chunked feeding would
// add no value while complicating error paths.
const readStreamAsUtf8 = async (source: Readable): Promise<string> => {
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
    return adapt(await readStreamAsUtf8(source))
  }
}
