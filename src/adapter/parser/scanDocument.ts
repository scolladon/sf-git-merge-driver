import {
  ATTR_PREFIX,
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { NormalisedParseResult } from '../XmlParser.js'
import { findTagEnd } from './balanceOracle.js'
import { BANG, isQuote, LT, QMARK, SLASH } from './charCodes.js'
import { type AttrSet, ElementFrame, NO_ATTRS } from './ElementFrame.js'
import {
  type LexedOpenTag,
  lexOpenTag,
  type OpenTagAttrs,
} from './lexOpenTag.js'
import {
  UNTERMINATED_COMMENT,
  UNTERMINATED_DECLARATION,
  UNTERMINATED_PROCESSING_INSTRUCTION,
  UNTERMINATED_TAG,
  unbalancedTags,
  unexpectedCloseTag,
} from './parseErrors.js'
import {
  CDATA_CLOSE,
  CDATA_OPEN,
  CLOSE_TAG_OPEN,
  COMMENT_CLOSE,
  COMMENT_OPEN,
  PI_CLOSE,
  PI_OPEN,
} from './xmlTokens.js'

export type ScanOutcome =
  | {
      readonly kind: 'parsed'
      readonly result: NormalisedParseResult
      readonly needsOracle: boolean
    }
  | { readonly kind: 'failed'; readonly message: string }

const TOP_FRAME_NAME = ''
const XMLNS_RE = /^xmlns(?::.+)?$/
const SHORT_COMMENT_LIMIT = COMMENT_OPEN.length + COMMENT_CLOSE.length

const failed = (message: string): ScanOutcome => ({ kind: 'failed', message })

const hasQuoteChar = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    if (isQuote(text.charCodeAt(i))) return true
  }
  return false
}

interface RootAttrSplit {
  readonly rest: AttrSet
  readonly namespaces: JsonObject
}

// Splits the root element's attrs into the xmlns* bucket (namespaces,
// `@_`-prefixed) and the rest (rootAttrs). Only ever called for the
// document root — a non-root element's xmlns attrs stay inline.
const splitRootAttrs = (attrs: OpenTagAttrs): RootAttrSplit => {
  const rootAttrs: Record<string, string | null> = Object.create(null)
  const namespaces: JsonObject = {}
  let hasRootAttrs = false
  for (const key in attrs) {
    if (XMLNS_RE.test(key)) {
      namespaces[`${ATTR_PREFIX}${key}`] = attrs[key]
    } else {
      rootAttrs[key] = attrs[key]
      hasRootAttrs = true
    }
  }
  return { rest: { attrs: rootAttrs, hasAttrs: hasRootAttrs }, namespaces }
}

interface RootElement {
  readonly name: string
  readonly value: JsonValue
}

// One-pass token scanner over an explicit frame stack (no recursion).
// The stack always starts with a sentinel top frame (name ''), whose
// only role is bookkeeping: it is never compacted, so the text and
// children it collects outside the root are dropped, and `stack.length
// === 1` is the "at top level" test used throughout.
class DocumentScanner {
  private readonly xml: string
  private readonly stack: ElementFrame[]
  private pos = 0
  private needsOracle = false
  private root: RootElement | undefined
  private namespaces: JsonObject = {}

  constructor(xml: string) {
    this.xml = xml
    this.stack = [new ElementFrame(TOP_FRAME_NAME, NO_ATTRS)]
  }

  run(): ScanOutcome {
    while (this.pos < this.xml.length) {
      const outcome = this.step()
      if (outcome !== undefined) return outcome
    }
    return this.finish()
  }

  private finish(): ScanOutcome {
    if (this.stack.length > 1) {
      return failed(unbalancedTags(this.stack.length - 1))
    }
    return this.parsedResult()
  }

  private parsedResult(): ScanOutcome {
    const result: NormalisedParseResult =
      this.root === undefined
        ? { content: {}, namespaces: {} }
        : {
            content: { [this.root.name]: this.root.value },
            namespaces: this.namespaces,
          }
    return { kind: 'parsed', result, needsOracle: this.needsOracle }
  }

  private step(): ScanOutcome | undefined {
    if (this.xml.charCodeAt(this.pos) !== LT) return this.scanText()
    const next = this.xml.charCodeAt(this.pos + 1)
    if (next === SLASH) return this.scanClose()
    if (next === BANG) return this.scanBang()
    if (next === QMARK) return this.scanProcessingInstruction()
    return this.scanOpenTag()
  }

  private scanText(): undefined {
    const next = this.xml.indexOf('<', this.pos)
    const end = next < 0 ? this.xml.length : next
    const text = this.xml.slice(this.pos, end).trim()
    if (text !== '') this.currentFrame().addText(text)
    this.pos = end
    return undefined
  }

  private scanClose(): ScanOutcome | undefined {
    const gt = this.xml.indexOf('>', this.pos + CLOSE_TAG_OPEN.length)
    if (gt < 0) return failed(UNTERMINATED_TAG)
    if (this.stack.length === 1) {
      this.needsOracle = true
      return this.parsedResult()
    }
    const closeText = this.xml.slice(this.pos + CLOSE_TAG_OPEN.length, gt)
    const frame = this.currentFrame()
    if (closeText.indexOf(frame.name) === -1) {
      return failed(unexpectedCloseTag(this.xml, gt))
    }
    if (hasQuoteChar(closeText)) this.needsOracle = true
    this.closeFrame()
    this.pos = gt + 1
    return undefined
  }

  // stack.pop() is only called with stack.length > 1 (scanClose returns
  // early at length 1), so the sentinel top frame is never popped and a
  // real frame always comes back.
  private closeFrame(): void {
    const popped = this.stack.pop()!
    this.addToParent(popped.name, popped.toCompact())
  }

  private addToParent(name: string, value: JsonValue): void {
    if (this.stack.length === 1) {
      if (this.root === undefined) this.root = { name, value }
      return
    }
    this.currentFrame().addChild(name, value)
  }

  private currentFrame(): ElementFrame {
    return this.stack[this.stack.length - 1]
  }

  private scanBang(): ScanOutcome | undefined {
    if (this.xml.startsWith(COMMENT_OPEN, this.pos)) return this.scanComment()
    if (this.xml.startsWith(CDATA_OPEN, this.pos)) return this.scanCdata()
    return this.scanDeclaration()
  }

  // The close search starts at the opener, not after `<!--`, so an
  // opener overlapping its own `-->` (`<!-->`, `<!--->`) is caught as a
  // short comment.
  private scanComment(): ScanOutcome | undefined {
    const end = this.xml.indexOf(COMMENT_CLOSE, this.pos)
    if (end < 0) return failed(UNTERMINATED_COMMENT)
    const tokenEnd = end + COMMENT_CLOSE.length
    if (tokenEnd - this.pos < SHORT_COMMENT_LIMIT) {
      this.needsOracle = true
      this.currentFrame().addText(this.xml.slice(this.pos, tokenEnd))
    } else {
      const body = this.xml.slice(this.pos + COMMENT_OPEN.length, end)
      this.currentFrame().addChild(XML_COMMENT_PROP_NAME, body)
    }
    this.pos = tokenEnd
    return undefined
  }

  private scanCdata(): ScanOutcome | undefined {
    const end = this.xml.indexOf(CDATA_CLOSE, this.pos + CDATA_OPEN.length)
    if (end < 0) return failed(UNTERMINATED_DECLARATION)
    const content = this.xml.slice(this.pos + CDATA_OPEN.length, end).trim()
    this.currentFrame().addChild(CDATA_PROP_NAME, content)
    this.pos = end + CDATA_CLOSE.length
    return undefined
  }

  private scanDeclaration(): ScanOutcome | undefined {
    const end = findTagEnd(this.xml, this.pos)
    if (end < 0) return failed(UNTERMINATED_DECLARATION)
    this.pos = end + 1
    return undefined
  }

  private scanProcessingInstruction(): ScanOutcome | undefined {
    const end = this.xml.indexOf(PI_CLOSE, this.pos + PI_OPEN.length)
    if (end < 0) return failed(UNTERMINATED_PROCESSING_INSTRUCTION)
    this.pos = end + PI_CLOSE.length
    return undefined
  }

  private scanOpenTag(): ScanOutcome | undefined {
    const lexed = lexOpenTag(this.xml, this.pos)
    if (lexed.kind === 'unterminated') return failed(UNTERMINATED_TAG)
    if (lexed.strayQuote) this.needsOracle = true
    this.pos = lexed.end
    if (lexed.selfClosing) {
      const frame = this.buildFrame(lexed)
      this.addToParent(frame.name, frame.toCompact())
      return undefined
    }
    this.stack.push(this.buildFrame(lexed))
    return undefined
  }

  private isRootCandidate(): boolean {
    return this.stack.length === 1 && this.root === undefined
  }

  private buildFrame(lexed: LexedOpenTag): ElementFrame {
    if (!this.isRootCandidate()) return new ElementFrame(lexed.name, lexed)
    const { rest, namespaces } = splitRootAttrs(lexed.attrs)
    this.namespaces = namespaces
    return new ElementFrame(lexed.name, rest)
  }
}

export const scanDocument = (xml: string): ScanOutcome =>
  new DocumentScanner(xml).run()
