import { once } from 'node:events'
import type { Writable } from 'node:stream'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../../constant/conflictConstant.js'
import {
  CDATA_PROP_NAME,
  NAMESPACE_ROOT,
  XML_COMMENT_PROP_NAME,
  XML_DECL,
  XML_INDENT,
} from '../../constant/parserConstant.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../../types/jsonTypes.js'

type Chunk =
  | { readonly kind: 'decl' }
  | {
      readonly kind: 'open'
      readonly name: string
      readonly attrs: ReadonlyArray<readonly [string, string]>
    }
  | { readonly kind: 'close'; readonly name: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cdata'; readonly value: string }
  | { readonly kind: 'comment'; readonly value: string }

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

const attrsToString = (
  attrs: ReadonlyArray<readonly [string, string]>
): string => attrs.map(([k, v]) => ` ${k}="${v}"`).join('')

// Traverse the compact merged tree and yield chunks, injecting
// namespace attributes onto the first top-level element.
// Caller in writeTo short-circuits on an empty input, so emit assumes
// at least one item. Namespace keys are always `@_`-prefixed by the
// parser side — we don't re-check here; malformed namespace maps would
// fail to parse upstream before they reach the writer.
function* emit(
  compactRoot: JsonArray,
  namespaces: JsonObject
): Generator<Chunk> {
  yield { kind: 'decl' }

  let isFirstTopLevel = true
  for (const item of compactRoot) {
    if (!isObject(item)) {
      yield { kind: 'text', value: String(item) }
      continue
    }
    for (const tagName of Object.keys(item).sort()) {
      if (tagName === NAMESPACE_ROOT) continue
      const extraAttrs: Array<readonly [string, string]> = []
      if (isFirstTopLevel) {
        for (const nsKey of Object.keys(namespaces).sort()) {
          extraAttrs.push([
            nsKey.slice(ATTR_PREFIX.length),
            String(namespaces[nsKey]),
          ])
        }
        isFirstTopLevel = false
      }
      yield* emitElement(tagName, item[tagName] as JsonValue, extraAttrs)
    }
  }
}

function* emitElement(
  name: string,
  body: JsonValue,
  extraAttrs: ReadonlyArray<readonly [string, string]>
): Generator<Chunk> {
  if (name === TEXT_KEY) {
    yield { kind: 'text', value: String(body) }
    return
  }
  if (name === XML_COMMENT_PROP_NAME) {
    yield { kind: 'comment', value: escapeCommentBody(String(body)) }
    return
  }
  if (name === CDATA_PROP_NAME) {
    const cdataStr = Array.isArray(body) ? body.join('') : String(body)
    yield { kind: 'cdata', value: escapeCdataBody(cdataStr) }
    return
  }

  const { attrs, children } = splitAttrsAndChildren(body)
  const allAttrs = [...extraAttrs, ...attrs]
  yield { kind: 'open', name, attrs: allAttrs }
  yield* emitChildren(children)
  yield { kind: 'close', name }
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

function* emitChildren(children: JsonArray): Generator<Chunk> {
  for (const child of children) {
    if (!isObject(child)) {
      yield { kind: 'text', value: String(child) }
      continue
    }
    for (const tagName of Object.keys(child).sort()) {
      yield* emitElement(tagName, child[tagName] as JsonValue, [])
    }
  }
}

// Turn chunks into a string stream, applying the lastEndedWithGt rule
// from design §6.3.2 for close-tag and mixed-content text indentation.
const formatChunks = (chunks: Iterable<Chunk>): string[] => {
  const out: string[] = []
  const frames: Array<{ depth: number; endedWithGt: boolean }> = [
    { depth: 0, endedWithGt: false },
  ]
  let isFirstTopLevelAfterDecl = true

  const indentFor = (depth: number) => `\n${XML_INDENT.repeat(depth)}`

  for (const chunk of chunks) {
    const top = frames[frames.length - 1]!
    if (chunk.kind === 'decl') {
      out.push(XML_DECL)
      continue
    }
    if (chunk.kind === 'open') {
      const attrStr = attrsToString(chunk.attrs)
      if (isFirstTopLevelAfterDecl) {
        out.push(`<${chunk.name}${attrStr}>`)
        isFirstTopLevelAfterDecl = false
      } else {
        out.push(`${indentFor(top.depth)}<${chunk.name}${attrStr}>`)
      }
      // Push the child frame; its `depth` is the level of ITS children.
      frames.push({ depth: top.depth + 1, endedWithGt: false })
      continue
    }
    if (chunk.kind === 'close') {
      // `top` here is the closing element's own frame — its `endedWithGt`
      // tells us whether the body last wrote a `>`-terminated chunk. But
      // the close tag itself sits at the PARENT's depth, so we indent
      // using the frame below `top`.
      const parentDepth = frames[frames.length - 2]!.depth
      if (top.endedWithGt) {
        out.push(`${indentFor(parentDepth)}</${chunk.name}>`)
      } else {
        out.push(`</${chunk.name}>`)
      }
      frames.pop()
      frames[frames.length - 1]!.endedWithGt = true
      continue
    }
    if (chunk.kind === 'text') {
      if (top.endedWithGt) {
        out.push(`${indentFor(top.depth)}${chunk.value}`)
      } else {
        out.push(chunk.value)
      }
      top.endedWithGt = false
      continue
    }
    if (chunk.kind === 'cdata') {
      if (top.endedWithGt) {
        out.push(`${indentFor(top.depth)}<![CDATA[${chunk.value}]]>`)
      } else {
        out.push(`<![CDATA[${chunk.value}]]>`)
      }
      top.endedWithGt = true
      continue
    }
    // comment: inline, no leading newline. Folds in current
    // post-correctComments behaviour by construction.
    out.push(`<!--${chunk.value}-->`)
    top.endedWithGt = true
  }
  return out
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
const applyEol = (chunks: string[], eol: '\n' | '\r\n'): string[] =>
  eol === '\n' ? chunks : chunks.map(c => c.replace(/\r?\n/g, eol))

export class XmlStreamWriter {
  constructor(private readonly config: MergeConfig) {}

  async writeTo(
    out: Writable,
    ordered: JsonArray,
    namespaces: JsonObject,
    eol: '\n' | '\r\n' = '\n'
  ): Promise<void> {
    if (ordered.length === 0) return

    const formatted = formatChunks(emit(ordered, namespaces))
    const filter = new ConflictLineFilter(this.config)
    const filtered: string[] = []
    for (const piece of formatted) filtered.push(filter.push(piece))
    filtered.push(filter.end())

    for (const piece of applyEol(filtered, eol)) {
      if (piece.length === 0) continue
      if (!out.write(piece)) {
        await once(out, 'drain')
      }
    }
  }
}
