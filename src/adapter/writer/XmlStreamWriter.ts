import { once } from 'node:events'
import type { Writable } from 'node:stream'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../../constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../../constant/metadataConstant.js'
import {
  CDATA_PROP_NAME,
  NAMESPACE_ROOT,
  XML_COMMENT_PROP_NAME,
  XML_DECL,
  XML_INDENT,
} from '../../constant/parserConstant.js'
import {
  type ConflictBlock,
  isConflictBlock,
} from '../../types/conflictBlock.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'
import { rootElementsIn } from '../../types/rootElements.js'
import type {
  RootAttributeSides,
  WriteOptions,
  XmlSerializer,
} from '../XmlSerializer.js'

const TEXT_KEY = '#text'
const ATTR_PREFIX = '@_'

const isObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// XML-spec escapes pinned by the 15-cdata-closing and 19-btb-comments
// fixtures and mirror the current pipeline (orderedJs2Xml.js:86, 94-95).
const escapeCommentBody = (value: string): string =>
  value.replace(/--/g, '- -').replace(/-$/, '- ')

// Adjacent sections are the parts of one text: they stay on one line, in order
const CDATA_PART_JOIN = ']]><![CDATA['

const escapeCdataBody = (value: string): string =>
  value.replace(/\]\]>/g, ']]]]><![CDATA[>')

// Values are emitted inside double quotes. A source attribute written with
// single quotes may legally hold a raw `"`, which would otherwise close the
// quote and let the rest of the value be read as markup. `&` is deliberately
// left alone: the parser never decodes entities on the way in, so re-encoding
// it here would corrupt values that already carry them.
// No "does it contain one?" fast path: skipping a replace that would not
// have matched is behaviourally invisible, so the branch could never be
// killed by a test.
const escapeAttrValue = (value: string): string =>
  value.replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Hot path called once per element. The previous map().join('') form
// allocated an intermediate array of formatted strings; this push-and-
// concat loop avoids that allocation.
const attrsToString = (
  attrs: ReadonlyArray<readonly [string, string]>
): string => {
  let s = ''
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i]!
    s += ` ${a[0]}="${escapeAttrValue(a[1])}"`
  }
  return s
}

// Declared here rather than next to writeRoot because writeConflict and
// writeChildren both use it as a default parameter value.
const EMPTY_ATTRS: ReadonlyArray<readonly [string, string]> = []

// When JsonMerger finds a three-way difference it can't resolve, it
// emits a ConflictBlock object in place of the conflicting node. The
// serializer's job is to expand that object into a stream of text and
// element chunks that render as git-style conflict markers. Matches
// FxpXmlSerializer.expandConflict at src/adapter/FxpXmlSerializer.ts:58.
interface ConflictMarkers {
  // A line whose first non-indent characters form a marker sequence
  readonly markerLine: RegExp
  readonly local: string
  readonly ancestor: string
  readonly separator: string
  readonly other: string
}

// Git splits lines on line feeds only: `^` with the `m` flag would also start
// a line after a carriage return, U+2028 or U+2029
const LINE_START = '(?<![^\\n])'

const buildConflictMarkers = (config: MergeConfig): ConflictMarkers => {
  const size = config.conflictMarkerSize
  const markerChars = [
    LOCAL_CONFLICT_MARKER,
    ANCESTOR_CONFLICT_MARKER,
    SEPARATOR,
    OTHER_CONFLICT_MARKER,
  ].join('')
  return {
    markerLine: new RegExp(
      `${LINE_START}([ \\t]*)([${markerChars}])(?=\\2{${size - 1}})`,
      'g'
    ),
    local: `${SALESFORCE_EOL}${LOCAL_CONFLICT_MARKER.repeat(size)} ${config.localConflictTag}`,
    ancestor: `${ANCESTOR_CONFLICT_MARKER.repeat(size)} ${config.ancestorConflictTag}`,
    separator: SEPARATOR.repeat(size),
    other: `${OTHER_CONFLICT_MARKER.repeat(size)} ${config.otherConflictTag}`,
  }
}

// State machine for the indent / mixed-content rule from design §6.3.2.
// Single mutable object passed through the recursive walk — replaces
// the per-chunk frame stack the previous generator pipeline maintained.
interface WalkState {
  buf: string
  // depth of the current frame (number of ancestor open tags)
  depth: number
  // whether the most recently emitted text-bearing chunk ended with `>`
  // (decides whether the next text/cdata/close needs a leading newline+indent)
  endedWithGt: boolean
  // the very first top-level open tag receives no leading indent (it
  // immediately follows the XML declaration)
  isFirstTopLevelAfterDecl: boolean
  // whether the merge produced a conflict, anywhere in the document: a content
  // line reading as a marker would split a block, or pass for one, wherever
  // it sits
  hasConflict: boolean
  // whether the buffer ends on a conflict marker. Kept apart from the buffer:
  // reading the end of a string built by appends flattens it each time
  endedOnMarker: boolean
  // [start, end) offsets in `buf` of the lines that belong to a value (text,
  // CDATA, comment, attribute value) spanning several lines: the conflict
  // filter must keep them whatever they hold
  valueLines: Array<readonly [number, number]>
}

type Attributes = ReadonlyArray<readonly [string, string]>

interface StartTagSides {
  readonly local: Attributes
  readonly ancestor: Attributes
  readonly other: Attributes
}

// What the element occupying the root slot opens with: the root attributes,
// and the start tags it is written as when those attributes conflict.
interface RootSlot {
  readonly attrs: Attributes
  readonly contested?: StartTagSides | undefined
  // Where a conflict occupying the whole document takes each side's own
  readonly sides?: StartTagSides | undefined
}

const NO_ROOT: RootSlot = { attrs: EMPTY_ATTRS }

const START_TAG_END = '>'
const EMPTY_TAG_END = '/>'

// Markers cannot go inside a start tag, so contested root attributes put the
// whole start tag, each side as it stands, between the markers: whichever side
// is kept leaves a well-formed file.
const startTagConflict = (
  markers: ConflictMarkers,
  sides: StartTagSides,
  tagOf: (attrs: Attributes) => string
): string =>
  [
    markers.local,
    tagOf(sides.local),
    markers.ancestor,
    tagOf(sides.ancestor),
    markers.separator,
    tagOf(sides.other),
    markers.other,
  ].join('\n')

// The opening of an element, which only the root slot's element can have as a
// conflict of its own
const openingOf = (
  sides: StartTagSides | undefined,
  markers: ConflictMarkers,
  indent: string,
  name: string,
  attrStr: string,
  terminator: string
): string => {
  if (sides === undefined) return `${indent}<${name}${attrStr}${terminator}`
  const tagOf = (attrs: Attributes): string =>
    `<${name}${attrsToString(attrs)}${terminator}`
  const lineEnd = terminator === START_TAG_END ? '\n' : ''
  return `${startTagConflict(markers, sides, tagOf)}${lineEnd}`
}

// A text line that reads as a marker is written with its first character as a
// numeric character reference, which XML reads as the same text.
const escapeMarkerLines = (value: string, markers: ConflictMarkers): string =>
  value.replace(
    markers.markerLine,
    (_, indent: string, char: string) => `${indent}&#${char.charCodeAt(0)};`
  )

// The first line of a value that follows an opening tag or an `="` never
// starts an output line, so only the lines after a line break can read as
// a marker.
const escapeLinesAfterBreak = (
  value: string,
  markers: ConflictMarkers
): string => {
  const firstBreak = value.indexOf('\n')
  if (firstBreak === -1) return value
  return (
    value.slice(0, firstBreak) +
    escapeMarkerLines(value.slice(firstBreak), markers)
  )
}

// Text written after a `>` starts on a fresh line of its own: its first line
// can read as a marker like any other.
const contentOf = (
  st: WalkState,
  markers: ConflictMarkers,
  value: string
): string => {
  if (!st.hasConflict) return value
  return st.endedWithGt
    ? escapeMarkerLines(value, markers)
    : escapeLinesAfterBreak(value, markers)
}

// Comments and CDATA hold no character references, so a marker-like line in
// them cannot be told apart from a real marker once the file holds a
// conflict. The first line follows the opening delimiter and cannot be one.
const assertNoMarkerLine = (
  st: WalkState,
  markers: ConflictMarkers,
  value: string
): void => {
  const firstLineEnd = value.indexOf('\n')
  if (!st.hasConflict || firstLineEnd === -1) return
  if (value.slice(firstLineEnd).search(markers.markerLine) === -1) return
  throw new Error(
    'XML merge error: a comment or CDATA line in a file holding a conflict reads as a conflict marker'
  )
}

const append = (st: WalkState, chunk: string): void => {
  st.buf += chunk
  st.endedOnMarker = false
}

const leadOf = (st: WalkState): string =>
  st.endedWithGt ? getIndent(st.depth) : ''

// The lines of `chunk` that follow the first line break at or after
// `valueFrom` are lines of a value, not lines the writer laid out
const appendValue = (st: WalkState, chunk: string, valueFrom: number): void => {
  // Stryker disable next-line StringLiteral: an empty search finds valueFrom, so a chunk with no break gets a range that starts past its own line starts and ends where the next line starts or later, which no line start falls inside
  const firstBreak = chunk.indexOf('\n', valueFrom)
  if (firstBreak !== -1) {
    st.valueLines.push([
      st.buf.length + firstBreak + 1,
      st.buf.length + chunk.length,
    ])
  }
  append(st, chunk)
}

const writeLayout = (st: WalkState, text: string): void => {
  append(st, `${leadOf(st)}${text}`)
  // Stryker disable next-line BooleanLiteral: every caller sets the flag again before reading it, save the blank side after a marker, where the lead is a whitespace-only line the conflict filter drops
  st.endedWithGt = false
}

const writeText = (st: WalkState, value: string): void => {
  const lead = leadOf(st)
  appendValue(st, `${lead}${value}`, lead.length)
  st.endedWithGt = false
}

const writeMarker = (st: WalkState, marker: string): void => {
  writeLayout(st, marker)
  st.endedOnMarker = true
}

const writeCdata = (st: WalkState, value: string): void => {
  const head = `${leadOf(st)}<![CDATA[`
  appendValue(st, `${head}${value}]]>`, head.length)
  st.endedWithGt = true
}

// A marker must stay alone on its line, so a comment never follows one
// there. After any other `>` it keeps following it on the same line.
const writeComment = (st: WalkState, value: string): void => {
  const head = st.endedOnMarker ? `${getIndent(st.depth)}<!--` : '<!--'
  appendValue(st, `${head}${value}-->`, head.length)
  st.endedWithGt = true
}

// `buildConflictMarkers` renders a side with no content as `[]`. `[{}]` still
// reaches the writer from a text-array `null` item (TextArrayMergeNode wraps
// `null` as `{}`), which is why the `.every` check stays. Without it, `[{}]`
// fell through to `writeChildren`, which iterates one object with zero own
// keys and appends nothing — leaving the marker for that side glued to
// the very next line with no newline in between (e.g. `||||||| base=======`).
// No separate `content.length === 0` check: `[].every(...)` is vacuously
// true, so an empty array already satisfies `.every()` on its own — a
// dedicated empty-array branch would never change the result.
const isBlankConflictSide = (content: JsonArray): boolean =>
  content.every(item => isObject(item) && Object.keys(item).length === 0)

const writeConflictContent = (
  st: WalkState,
  content: JsonArray,
  markers: ConflictMarkers,
  slot: RootSlot
): void => {
  // Empty side: emit the EOL placeholder so the marker pair stays on
  // its own line, matching the byte layout of the previous pipeline.
  // A blank side opens no element, so it never carries the root slot.
  if (isBlankConflictSide(content)) {
    writeLayout(st, SALESFORCE_EOL)
    return
  }
  // Non-empty: iteration is identical to writeChildren (first-seen /
  // insertion-order recursion into writeElement). Delegate instead of
  // inlining the same loop — the two paths produce byte-equivalent
  // output; the conflict path inherits first-seen order through the
  // shared writeChildren.
  // Text, comments and CDATA open no line of their own: starting the content
  // on a fresh line, and ending it so, keeps every marker alone on its line.
  st.endedWithGt = true
  writeChildren(st, content, markers, slot)
  st.endedWithGt = true
}

const writeConflict = (
  st: WalkState,
  block: ConflictBlock,
  markers: ConflictMarkers,
  // Only a conflict block occupying the whole document receives the root
  // attributes; nested conflict content is not a document root, so every
  // other call site falls back to the default.
  slot: RootSlot = NO_ROOT
): void => {
  const sideSlot = (side: keyof StartTagSides): RootSlot => ({
    attrs: slot.sides?.[side] ?? slot.attrs,
  })
  // A conflict block can be the very first thing ever written (e.g. one
  // side deletes the whole file while the other edits it). The "first
  // top-level element" indent suppression is meant for a normal open tag
  // right after the XML declaration, not for content nested inside a
  // conflict side — consume it here so the first real element inside
  // block.ancestor/other still gets its newline+indent instead of gluing
  // onto the marker line above it.
  st.isFirstTopLevelAfterDecl = false
  writeMarker(st, markers.local)
  writeConflictContent(st, block.local, markers, sideSlot('local'))
  writeMarker(st, markers.ancestor)
  writeConflictContent(st, block.ancestor, markers, sideSlot('ancestor'))
  writeMarker(st, markers.separator)
  writeConflictContent(st, block.other, markers, sideSlot('other'))
  writeMarker(st, markers.other)
  // The closing marker must stay alone on its line: whatever follows (a
  // close tag, a sibling) starts on a fresh indented line, as after any `>`.
  st.endedWithGt = true
}

// Root attributes (xmlns* and every other attribute of the source root)
// reach the wire on whichever element occupies the root slot. Insertion order of the bucket is the
// source order the parser saw, so it is preserved verbatim.
const buildRootAttrs = (
  rootAttributes: JsonObject
): ReadonlyArray<readonly [string, string]> => {
  const keys = Object.keys(rootAttributes)
  const built: Array<readonly [string, string]> = new Array(keys.length)
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]!
    built[k] = [key.slice(ATTR_PREFIX.length), String(rootAttributes[key])]
  }
  return built
}

// A line break inside a value would let one of its lines stand alone between
// the markers and read as a marker itself.
const LINE_BREAK = /\n/g
const LINE_BREAK_REFERENCE = '&#10;'

const inConflict = (attrs: Attributes): Attributes =>
  attrs.map(([name, value]) => [
    name,
    value.replace(LINE_BREAK, LINE_BREAK_REFERENCE),
  ])

const startTagSidesOf = (sides: RootAttributeSides): StartTagSides => ({
  local: inConflict(buildRootAttrs(sides.local)),
  ancestor: inConflict(buildRootAttrs(sides.ancestor)),
  other: inConflict(buildRootAttrs(sides.other)),
})

const rootSlotOf = (
  rootAttributes: JsonObject,
  { contested, sides }: WriteOptions
): RootSlot => ({
  attrs: buildRootAttrs(rootAttributes),
  contested: contested && startTagSidesOf(contested),
  sides: sides && startTagSidesOf(sides),
})

// Whichever element opens the document carries the root attributes, then the
// slot is spent. A whole-document ConflictBlock spends it too — each of its
// non-blank sides renders a document root. A top-level scalar or a bare
// namespace key opens no element, so it leaves the slot for the next item.
const opensRootSlot = (item: JsonValue): boolean => rootElementsIn(item) > 0

const writeRootObject = (
  st: WalkState,
  item: JsonObject,
  slot: RootSlot,
  markers: ConflictMarkers
): void => {
  const tags = Object.keys(item).filter(key => key !== NAMESPACE_ROOT)
  tags.forEach((tagName, index) =>
    writeElement(
      st,
      tagName,
      item[tagName] as JsonValue,
      index === 0 ? slot : NO_ROOT,
      markers
    )
  )
}

const writeRootItem = (
  st: WalkState,
  item: JsonValue,
  slot: RootSlot,
  markers: ConflictMarkers
): void => {
  if (isConflictBlock(item)) return writeConflict(st, item, markers, slot)
  if (!isObject(item)) return writeText(st, String(item))
  writeRootObject(st, item, slot, markers)
}

// Walk the compact merged tree and append serialized XML directly into
// `st.buf`. Replaces the old `emit()` + `formatChunks()` generator pair:
// one recursive function, no chunk objects, no generator state machines,
// no `for...of` over generators. Profile attributed ~40 % of serialize
// CPU to that pipeline.
const writeRoot = (
  st: WalkState,
  compactRoot: JsonArray,
  slot: RootSlot,
  markers: ConflictMarkers
): void => {
  append(st, XML_DECL)
  const slotIndex = compactRoot.findIndex(item =>
    opensRootSlot(item as JsonValue)
  )
  compactRoot.forEach((item, index) =>
    writeRootItem(
      st,
      item as JsonValue,
      index === slotIndex ? slot : NO_ROOT,
      markers
    )
  )
}

// An element renders empty when every child produces no output. The only
// such child is empty text (`{ '#text': '' }`) — the shape a `''` or
// attr-only body collapses to in splitAttrsAndChildren, and what both
// `<tag/>` and `<tag></tag>` parse to via CompactXmlParser. An element with no
// children is empty too (`[].every` is vacuously true). `sf project retrieve`
// self-closes every empty element, so the writer matches that wire form.
const isEmptyElementBody = (children: JsonArray): boolean =>
  children.every(child => isObject(child) && child[TEXT_KEY] === '')

const attributesOf = (
  st: WalkState,
  markers: ConflictMarkers,
  attrs: Attributes
): Attributes =>
  st.hasConflict
    ? attrs.map(([name, value]) => [
        name,
        escapeLinesAfterBreak(value, markers),
      ])
    : attrs

const CONTENT_NAMES: ReadonlySet<string> = new Set([
  TEXT_KEY,
  XML_COMMENT_PROP_NAME,
  CDATA_PROP_NAME,
])

// Two comments under one parent are an array of comments: each one is a
// comment of its own, where CDATA sections are one text.
const writeComments = (
  st: WalkState,
  markers: ConflictMarkers,
  body: JsonValue
): void => {
  for (const comment of Array.isArray(body) ? body : [body]) {
    const text = String(comment)
    assertNoMarkerLine(st, markers, text)
    writeComment(st, escapeCommentBody(text))
  }
}

const writeContent = (
  st: WalkState,
  name: string,
  body: JsonValue,
  markers: ConflictMarkers
): void => {
  if (name === TEXT_KEY) {
    return writeText(st, contentOf(st, markers, String(body)))
  }
  if (name === XML_COMMENT_PROP_NAME) return writeComments(st, markers, body)
  const parts = (Array.isArray(body) ? body : [body]).map(String)
  for (const part of parts) assertNoMarkerLine(st, markers, part)
  writeCdata(st, parts.map(escapeCdataBody).join(CDATA_PART_JOIN))
}

// Avoid the [...extraAttrs, ...attrs] allocation when extraAttrs is
// empty (the common case — only the first top-level open tag carries
// any extras). attrsToString itself handles concatenation.
const attributeString = (slot: RootSlot, attrs: Attributes): string =>
  // Stryker disable next-line ConditionalExpression: a shortcut, the root attributes of an empty slot add the empty string
  slot.attrs === EMPTY_ATTRS
    ? attrsToString(attrs)
    : attrsToString(slot.attrs) + attrsToString(attrs)

const writeOpening = (
  st: WalkState,
  name: string,
  slot: RootSlot,
  markers: ConflictMarkers,
  attrs: Attributes,
  terminator: string
): void => {
  const indent = st.isFirstTopLevelAfterDecl ? '' : getIndent(st.depth)
  st.isFirstTopLevelAfterDecl = false
  const opening = openingOf(
    slot.contested,
    markers,
    indent,
    name,
    attributeString(
      { ...slot, attrs: attributesOf(st, markers, slot.attrs) },
      attrs
    ),
    terminator
  )
  appendValue(st, opening, indent.length)
}

const writeBody = (
  st: WalkState,
  name: string,
  children: JsonArray,
  markers: ConflictMarkers
): void => {
  const parentDepth = st.depth
  st.depth = parentDepth + 1
  st.endedWithGt = false
  writeChildren(st, children, markers)
  append(
    st,
    st.endedWithGt ? `${getIndent(parentDepth)}</${name}>` : `</${name}>`
  )
  st.depth = parentDepth
}

const writeElement = (
  st: WalkState,
  name: string,
  body: JsonValue,
  slot: RootSlot,
  markers: ConflictMarkers
): void => {
  if (CONTENT_NAMES.has(name)) return writeContent(st, name, body, markers)
  if (isConflictBlock(body)) return writeConflict(st, body, markers)

  const { attrs: sourceAttrs, children } = splitAttrsAndChildren(body)
  const attrs = attributesOf(st, markers, sourceAttrs)
  // Empty elements self-close (`<tag/>`): `sf project retrieve` never emits
  // the expanded `<tag></tag>` form, so the merge output converges to its
  // byte shape.
  const isEmpty = isEmptyElementBody(children)
  const terminator = isEmpty ? EMPTY_TAG_END : START_TAG_END
  writeOpening(st, name, slot, markers, attrs, terminator)
  if (!isEmpty) writeBody(st, name, children, markers)
  // Both forms end on a `>`, so the parent frame always sees
  // endedWithGt=true, whatever the body's terminating chunk was.
  st.endedWithGt = true
}

// Emit a (key, value) pair from a multi-key wrapper child by applying the
// parser-shape array-unfolding that splitAttrsAndChildren already applies
// on object bodies: an array value means N repeated `<tagName>` siblings,
// one per entry. Required because canonical merger output uses single-key
// wrappers, so a multi-key wrapper in writeChildren is always a
// parser-shape leak from a pass-through path (e.g. KeyedArrayMergeNode
// unmatched entries). Without this unfold the writer would invoke
// writeElement once with the array body, collapsing repeats into a
// single element with concatenated text content.
//
// Empty arrays still emit one empty element (matches the AncestorOnlyStrategy
// `{name: []}` contract); writeElement self-closes it as `<name/>`.
const writeUnfoldedChild = (
  st: WalkState,
  tagName: string,
  value: JsonValue,
  markers: ConflictMarkers
): void => {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    tagName !== CDATA_PROP_NAME &&
    tagName !== XML_COMMENT_PROP_NAME
  ) {
    for (let i = 0; i < value.length; i++) {
      writeElement(st, tagName, value[i] as JsonValue, NO_ROOT, markers)
    }
    return
  }
  writeElement(st, tagName, value, NO_ROOT, markers)
}

const writeChildren = (
  st: WalkState,
  children: JsonArray,
  markers: ConflictMarkers,
  // Non-empty only when these children ARE a conflict side's content and
  // that side occupies the document root; the head child then opens the
  // side's root element. The multi-key branch below never receives them:
  // a conflict side's head is always a single-key wrapper.
  slot: RootSlot = NO_ROOT
): void => {
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as JsonValue
    const childSlot = i === 0 ? slot : NO_ROOT
    if (isConflictBlock(child)) {
      writeConflict(st, child, markers, childSlot)
      continue
    }
    if (!isObject(child)) {
      writeText(st, contentOf(st, markers, String(child)))
      continue
    }
    const keys = Object.keys(child)
    if (keys.length === 1) {
      // Canonical merger output: single-key wrapper. Treat the value as
      // the body of one `<tagName>` element (writer semantic). An inner
      // parser-shape multi-key object is handled by the next recursion
      // into writeChildren via splitAttrsAndChildren / the multi-key
      // branch below.
      const tagName = keys[0]!
      writeElement(st, tagName, child[tagName] as JsonValue, childSlot, markers)
      continue
    }
    for (let j = 0; j < keys.length; j++) {
      const tagName = keys[j]!
      writeUnfoldedChild(st, tagName, child[tagName] as JsonValue, markers)
    }
  }
}

interface AttrsAndChildren {
  readonly attrs: ReadonlyArray<readonly [string, string]>
  readonly children: JsonArray
}

const splitAttrsAndChildren = (body: JsonValue): AttrsAndChildren => {
  if (body === null || body === undefined) {
    return { attrs: [], children: [] }
  }
  if (typeof body !== 'object') {
    return { attrs: [], children: [{ [TEXT_KEY]: body }] }
  }
  if (Array.isArray(body)) {
    return { attrs: [], children: body }
  }
  const attrs: Array<readonly [string, string]> = []
  const childTags: JsonArray = []
  for (const key of Object.keys(body)) {
    const value = body[key]
    if (key.startsWith(ATTR_PREFIX)) {
      attrs.push([key.slice(ATTR_PREFIX.length), String(value)])
    } else if (
      Array.isArray(value) &&
      key !== CDATA_PROP_NAME &&
      key !== XML_COMMENT_PROP_NAME
    ) {
      // Regular array values are the "repeated child element" pattern.
      // CDATA and comment arrays carry content, not repeated elements
      // (the parser splits CDATA segments on `]]>`; we keep the array
      // intact so emitElement can re-join with the escape pattern).
      for (const entry of value) childTags.push({ [key]: entry as JsonValue })
    } else {
      childTags.push({ [key]: value as JsonValue })
    }
  }
  return { attrs, children: childTags }
}

// Indent cache: depth is bounded (realistic Salesforce profiles reach
// depth 4–5). String.repeat is cheap but memoising once saves
// thousands of allocations on large documents.
const indentCache: string[] = []
const getIndent = (depth: number): string => {
  let cached = indentCache[depth]
  if (cached === undefined) {
    cached = `\n${XML_INDENT.repeat(depth)}`
    indentCache[depth] = cached
  }
  return cached
}

// Design §6.3.3 line-state machine: strip horizontal whitespace before
// a marker on the same line (pass 1), drop whitespace-only lines
// (pass 2), but never a line of a value. Newline belongs to the line it
// terminates.
class ConflictLineFilter {
  private buf = ''
  // offset in the document of the line being read
  private lineStart = 0
  private nextValue = 0
  private readonly markers: readonly string[]

  constructor(
    config: MergeConfig,
    private readonly valueLines: ReadonlyArray<readonly [number, number]>
  ) {
    this.markers = [
      LOCAL_CONFLICT_MARKER.repeat(config.conflictMarkerSize),
      ANCESTOR_CONFLICT_MARKER.repeat(config.conflictMarkerSize),
      SEPARATOR.repeat(config.conflictMarkerSize),
      OTHER_CONFLICT_MARKER.repeat(config.conflictMarkerSize),
    ]
  }

  push(chunk: string): string {
    // Always called from writeTo with FLUSH_BYTES (16 KiB) slices of the
    // serialized document, which contain at least one newline in any
    // realistic XML output (indent newlines come at every element). The
    // previous "no-newline fast path" went dead once the per-chunk
    // generator pipeline was replaced by buffered serialization.
    const out: string[] = []
    let working = chunk
    while (true) {
      const nl = working.indexOf('\n')
      if (nl < 0) {
        this.buf += working
        break
      }
      this.buf += working.slice(0, nl)
      this.flushLine(out, true)
      working = working.slice(nl + 1)
    }
    return out.join('')
  }

  end(): string {
    // Always flush the tail: in the normal flow the document ends
    // mid-line (e.g., `</Root>` with no trailing newline), so buf
    // carries residual content. flushLine is a no-op when buf is
    // empty (blank-line branch drops it), so this stays correct.
    const out: string[] = []
    this.flushLine(out, false)
    return out.join('')
  }

  // Lines are read in document order, and so are the value ranges: those
  // that end before the line are behind for good
  private skipValuesBefore(lineStart: number): void {
    let range = this.valueLines[this.nextValue]
    while (range !== undefined && range[1] <= lineStart) {
      range = this.valueLines[++this.nextValue]
    }
  }

  private isInValue(lineStart: number): boolean {
    const range = this.valueLines[this.nextValue]
    return range !== undefined && range[0] <= lineStart
  }

  private flushLine(out: string[], withNewline: boolean): void {
    let line = this.buf
    this.skipValuesBefore(this.lineStart)
    const isValueLine = this.isInValue(this.lineStart)
    this.lineStart += line.length + 1
    this.buf = ''
    // Pass 1: strip horizontal whitespace directly before a marker on
    // this line. Mirrors ConflictMarkerFormatter.indentRegex semantics.
    const leadingWs = /^([ \t]+)(.*)$/.exec(line)
    if (
      leadingWs !== null &&
      this.markers.some(m => leadingWs[2]!.startsWith(m))
    ) {
      line = leadingWs[2]!
    }
    // Pass 2: drop whitespace-only lines (including their '\n').
    if (!isValueLine && /^[ \t]*$/.test(line)) return
    out.push(withNewline ? `${line}\n` : line)
  }
}

// Rewrite LF → target EOL at byte level. Kept orthogonal per §6.3.4.
const applyEol = (piece: string, eol: '\n' | '\r\n'): string =>
  eol === '\n' ? piece : piece.replace(/\r?\n/g, eol)

// Flush threshold for the write-side accumulator. Matches the default
// Node stream high-water-mark (16 KiB); batching up to that means we
// call `out.write` at most once per high-water-mark window instead of
// once per emitted chunk. Each `out.write` emits `'data'`, runs the
// high-water-mark check, and may schedule a drain — per-call overhead
// that dominates serialize CPU on small documents when the sink is
// already in memory. A larger batch would amortise more but would also
// inflate peak working set; 16 KiB is the smallest size that keeps
// `write` cheap AND preserves streaming semantics.
const FLUSH_BYTES = 16 * 1024

// Single trailing newline appended to every non-empty document so the merge
// driver's byte output matches `sf project retrieve` (metadata XML ends in a
// newline). applyEol rewrites it to the target EOL.
const TRAILING_NEWLINE = '\n'

export class XmlStreamWriter implements XmlSerializer {
  constructor(private readonly config: MergeConfig) {}

  async writeTo(
    out: Writable,
    ordered: JsonArray,
    rootAttributes: JsonObject,
    options: WriteOptions = {}
  ): Promise<void> {
    if (ordered.length === 0) return
    const { eol = '\n', hasConflict = true } = options

    // Pipelined: each formatted string flows emit → format → (filter) →
    // accumulator → eol → out.write. The accumulator batches filter
    // output into FLUSH_BYTES windows before calling out.write — without
    // it, a document emitting N chunks pays N `out.write()` calls.
    //
    // When the merge produced no conflicts, the ConflictLineFilter has
    // nothing to do (its only job is to clean indentation and blank
    // lines around marker tokens, none of which are emitted). Skipping
    // it removes ~20 % of serialize CPU on conflict-free documents
    // (newline scan + two regexes per line).
    const markers = buildConflictMarkers(this.config)
    const st: WalkState = {
      buf: '',
      depth: 0,
      endedWithGt: false,
      isFirstTopLevelAfterDecl: true,
      hasConflict,
      // Stryker disable next-line BooleanLiteral: writeRoot appends the declaration first, which clears the flag
      endedOnMarker: false,
      valueLines: [],
    }
    writeRoot(st, ordered, rootSlotOf(rootAttributes, options), markers)
    // Trailing newline: `sf project retrieve` (via source-deploy-retrieve)
    // writes metadata XML ending in a newline, so we converge to that byte
    // shape (see TRAILING_NEWLINE). Appended to the finished document AFTER
    // the conflict filter has flushed the closing tag (the filter still ends
    // mid-line, as before), and applyEol rewrites it to the target EOL. The
    // `ordered.length === 0` short-circuit above means an empty document
    // still emits nothing.
    // For the conflict-free hot path, the entire document is built in
    // st.buf as a single string; one applyEol pass + at most one
    // out.write. The intermediate FLUSH_BYTES batching matters only
    // when ConflictLineFilter is in play (it splits chunks line-by-line
    // and we re-emit incrementally).
    if (!hasConflict) {
      const final = applyEol(`${st.buf}${TRAILING_NEWLINE}`, eol)
      if (!out.write(final)) {
        await once(out, 'drain')
      }
      return
    }

    // Conflict path: re-stream st.buf through the line filter in
    // FLUSH_BYTES windows so we don't buffer the entire document twice
    // (once in st.buf, once in the filter).
    const filter = new ConflictLineFilter(this.config, st.valueLines)
    let batch = ''
    const flush = async (): Promise<void> => {
      const final = applyEol(batch, eol)
      batch = ''
      if (!out.write(final)) {
        await once(out, 'drain')
      }
    }
    for (let i = 0; i < st.buf.length; i += FLUSH_BYTES) {
      // Empty-filter-output is permitted (a slice that became all-blank
      // after pass-2 drops returns ''); appending '' is a cheap no-op
      // and keeps the loop branch-free.
      batch += filter.push(st.buf.slice(i, i + FLUSH_BYTES))
      if (batch.length >= FLUSH_BYTES) await flush()
    }
    batch += filter.end()
    batch += TRAILING_NEWLINE
    await flush()
  }
}
