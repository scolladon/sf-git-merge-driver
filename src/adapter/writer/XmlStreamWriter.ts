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
import type { XmlSerializer } from '../XmlSerializer.js'

const TEXT_KEY = '#text'
const ATTR_PREFIX = '@_'

const isObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// XML-spec escapes pinned by the 15-cdata-closing and 19-btb-comments
// fixtures and mirror the current pipeline (orderedJs2Xml.js:86, 94-95).
const escapeCommentBody = (value: string): string =>
  value.replace(/--/g, '- -').replace(/-$/, '- ')

const escapeCdataBody = (value: string): string =>
  value.replace(/\]\]>/g, ']]]]><![CDATA[>')

// Hot path called once per element. The previous map().join('') form
// allocated an intermediate array of formatted strings; this push-and-
// concat loop avoids that allocation.
const attrsToString = (
  attrs: ReadonlyArray<readonly [string, string]>
): string => {
  let s = ''
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i]!
    s += ` ${a[0]}="${a[1]}"`
  }
  return s
}

// When JsonMerger finds a three-way difference it can't resolve, it
// emits a ConflictBlock object in place of the conflicting node. The
// serializer's job is to expand that object into a stream of text and
// element chunks that render as git-style conflict markers. Matches
// FxpXmlSerializer.expandConflict at src/adapter/FxpXmlSerializer.ts:58.
interface ConflictMarkers {
  readonly local: string
  readonly ancestor: string
  readonly separator: string
  readonly other: string
}

const buildConflictMarkers = (config: MergeConfig): ConflictMarkers => {
  const size = config.conflictMarkerSize
  return {
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
}

const writeText = (st: WalkState, value: string): void => {
  st.buf += st.endedWithGt ? `${getIndent(st.depth)}${value}` : value
  st.endedWithGt = false
}

const writeCdata = (st: WalkState, value: string): void => {
  st.buf += st.endedWithGt
    ? `${getIndent(st.depth)}<![CDATA[${value}]]>`
    : `<![CDATA[${value}]]>`
  st.endedWithGt = true
}

const writeComment = (st: WalkState, value: string): void => {
  st.buf += `<!--${value}-->`
  st.endedWithGt = true
}

// Returns true if the item was a ConflictBlock or scalar (handled
// in-place); false if the caller still has to iterate the item's keys.
const writeNonObjectItem = (
  st: WalkState,
  item: JsonValue,
  markers: ConflictMarkers
): boolean => {
  if (isConflictBlock(item)) {
    writeConflict(st, item, markers)
    return true
  }
  if (!isObject(item)) {
    writeText(st, String(item))
    return true
  }
  return false
}

const writeConflictContent = (
  st: WalkState,
  content: JsonArray,
  markers: ConflictMarkers
): void => {
  // Empty side: emit the EOL placeholder so the marker pair stays on
  // its own line, matching the byte layout of the previous pipeline.
  if (content.length === 0) {
    writeText(st, SALESFORCE_EOL)
    return
  }
  // Non-empty: iteration is identical to writeChildren (sorted-key
  // recursion into writeElement). Delegate instead of inlining the same
  // loop — the two paths produced byte-equivalent output, only the
  // single-key fast-path branch differed which is a sort-skip
  // optimisation that's a no-op when keys.length === 1.
  writeChildren(st, content, markers)
}

const writeConflict = (
  st: WalkState,
  block: ConflictBlock,
  markers: ConflictMarkers
): void => {
  writeText(st, markers.local)
  writeConflictContent(st, block.local, markers)
  writeText(st, markers.ancestor)
  writeConflictContent(st, block.ancestor, markers)
  writeText(st, markers.separator)
  writeConflictContent(st, block.other, markers)
  writeText(st, markers.other)
}

const EMPTY_ATTRS: ReadonlyArray<readonly [string, string]> = []

// Walk the compact merged tree and append serialized XML directly into
// `st.buf`. Replaces the old `emit()` + `formatChunks()` generator pair:
// one recursive function, no chunk objects, no generator state machines,
// no `for...of` over generators. Profile attributed ~40 % of serialize
// CPU to that pipeline.
const writeRoot = (
  st: WalkState,
  compactRoot: JsonArray,
  namespaces: JsonObject,
  markers: ConflictMarkers
): void => {
  st.buf += XML_DECL
  let isFirstTopLevel = true
  for (let i = 0; i < compactRoot.length; i++) {
    const item = compactRoot[i] as JsonValue
    if (writeNonObjectItem(st, item, markers)) continue
    const obj = item as JsonObject
    const keys = Object.keys(obj).sort()
    for (let j = 0; j < keys.length; j++) {
      const tagName = keys[j]!
      if (tagName === NAMESPACE_ROOT) continue
      let extraAttrs: ReadonlyArray<readonly [string, string]> = EMPTY_ATTRS
      if (isFirstTopLevel) {
        const nsKeys = Object.keys(namespaces).sort()
        const built: Array<readonly [string, string]> = new Array(nsKeys.length)
        for (let k = 0; k < nsKeys.length; k++) {
          const nsKey = nsKeys[k]!
          built[k] = [
            nsKey.slice(ATTR_PREFIX.length),
            String(namespaces[nsKey]),
          ]
        }
        extraAttrs = built
        isFirstTopLevel = false
      }
      writeElement(st, tagName, obj[tagName] as JsonValue, extraAttrs, markers)
    }
  }
}

const writeElement = (
  st: WalkState,
  name: string,
  body: JsonValue,
  extraAttrs: ReadonlyArray<readonly [string, string]>,
  markers: ConflictMarkers
): void => {
  if (name === TEXT_KEY) {
    writeText(st, String(body))
    return
  }
  if (name === XML_COMMENT_PROP_NAME) {
    writeComment(st, escapeCommentBody(String(body)))
    return
  }
  if (name === CDATA_PROP_NAME) {
    const cdataStr = Array.isArray(body) ? body.join('') : String(body)
    writeCdata(st, escapeCdataBody(cdataStr))
    return
  }

  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    if (isConflictBlock(body as JsonObject as JsonValue)) {
      writeConflict(st, body as ConflictBlock, markers)
      return
    }
  }

  const { attrs, children } = splitAttrsAndChildren(body)
  // Avoid the [...extraAttrs, ...attrs] allocation when extraAttrs is
  // empty (the common case — only the first top-level open tag carries
  // any extras). attrsToString itself handles concatenation.
  const attrStr =
    extraAttrs === EMPTY_ATTRS
      ? attrsToString(attrs)
      : attrsToString(extraAttrs) + attrsToString(attrs)

  if (st.isFirstTopLevelAfterDecl) {
    st.buf += `<${name}${attrStr}>`
    st.isFirstTopLevelAfterDecl = false
  } else {
    st.buf += `${getIndent(st.depth)}<${name}${attrStr}>`
  }
  const parentDepth = st.depth
  st.depth = parentDepth + 1
  const savedEndedWithGt = st.endedWithGt
  st.endedWithGt = false
  writeChildren(st, children, markers)
  if (st.endedWithGt) {
    st.buf += `${getIndent(parentDepth)}</${name}>`
  } else {
    st.buf += `</${name}>`
  }
  st.depth = parentDepth
  st.endedWithGt = true
  // savedEndedWithGt is unused — close-tag always sets endedWithGt=true
  // for the parent frame. Keep the variable read to silence noUnused.
  void savedEndedWithGt
}

const writeChildren = (
  st: WalkState,
  children: JsonArray,
  markers: ConflictMarkers
): void => {
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as JsonValue
    if (isConflictBlock(child)) {
      writeConflict(st, child, markers)
      continue
    }
    if (!isObject(child)) {
      writeText(st, String(child))
      continue
    }
    const keys = Object.keys(child)
    if (keys.length === 1) {
      const tagName = keys[0]!
      writeElement(
        st,
        tagName,
        child[tagName] as JsonValue,
        EMPTY_ATTRS,
        markers
      )
      continue
    }
    keys.sort()
    for (let j = 0; j < keys.length; j++) {
      const tagName = keys[j]!
      writeElement(
        st,
        tagName,
        child[tagName] as JsonValue,
        EMPTY_ATTRS,
        markers
      )
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
  for (const key of Object.keys(body).sort()) {
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
// (pass 2). Newline belongs to the line it terminates.
class ConflictLineFilter {
  private buf = ''
  private readonly markers: readonly string[]

  constructor(config: MergeConfig) {
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

  private flushLine(out: string[], withNewline: boolean): void {
    let line = this.buf
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
    if (/^[ \t]*$/.test(line)) return
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

export class XmlStreamWriter implements XmlSerializer {
  constructor(private readonly config: MergeConfig) {}

  async writeTo(
    out: Writable,
    ordered: JsonArray,
    namespaces: JsonObject,
    eol: '\n' | '\r\n' = '\n',
    hasConflict = true
  ): Promise<void> {
    if (ordered.length === 0) return

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
    }
    writeRoot(st, ordered, namespaces, markers)
    // For the conflict-free hot path, the entire document is built in
    // st.buf as a single string; one applyEol pass + at most one
    // out.write. The intermediate FLUSH_BYTES batching matters only
    // when ConflictLineFilter is in play (it splits chunks line-by-line
    // and we re-emit incrementally).
    if (!hasConflict) {
      const final = applyEol(st.buf, eol)
      if (!out.write(final)) {
        await once(out, 'drain')
      }
      return
    }

    // Conflict path: re-stream st.buf through the line filter in
    // FLUSH_BYTES windows so we don't buffer the entire document twice
    // (once in st.buf, once in the filter).
    const filter = new ConflictLineFilter(this.config)
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
    await flush()
  }
}
