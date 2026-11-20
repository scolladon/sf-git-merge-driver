import {
  ATTR_PREFIX,
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { NormalisedParseResult } from '../XmlParser.js'
import { findTagEnd } from './balanceOracle.js'
import {
  BANG,
  isQuote,
  isXmlWhitespace,
  LT,
  QMARK,
  SLASH,
  trimXmlWhitespace,
} from './charCodes.js'
import { ElementFrame, NO_ATTRS } from './ElementFrame.js'
import {
  type LexedOpenTag,
  lexOpenTag,
  type OpenTagAttrs,
} from './lexOpenTag.js'
import {
  CONTENT_OUTSIDE_ROOT,
  DECLARATION_IN_ROOT,
  MALFORMED_ATTRIBUTE,
  MALFORMED_ELEMENT_NAME,
  MISPLACED_XML_DECLARATION,
  PROCESSING_INSTRUCTION_IN_ROOT,
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
  XML_DECLARATION_TARGET,
} from './xmlTokens.js'

export type ScanOutcome =
  | {
      readonly kind: 'parsed'
      readonly result: NormalisedParseResult
      readonly needsOracle: boolean
    }
  | { readonly kind: 'failed'; readonly message: string }

// Stryker disable next-line StringLiteral: the sentinel's name is never read: a top-level close returns first
const TOP_FRAME_NAME = ''
const SHORT_COMMENT_LIMIT = COMMENT_OPEN.length + COMMENT_CLOSE.length

const failed = (message: string): ScanOutcome => ({ kind: 'failed', message })

const hasQuoteChar = (text: string): boolean => {
  // Stryker disable next-line EqualityOperator: charCodeAt(length) is NaN, not a quote
  for (let i = 0; i < text.length; i++) {
    if (isQuote(text.charCodeAt(i))) return true
  }
  return false
}

// Moves every attribute of the document root into the root-attribute
// bucket (`rootAttributes`, `@_`-prefixed): the xmlns declarations and any
// other attribute alike (e.g. `xsi:schemaLocation`). XmlMerger resolves
// that bucket key by key and the writer renders it back on the root open
// tag. Left on the element, a root attribute would reach the
// property-by-property merge, which writes it out as a child element
// (`<@_xsi:schemaLocation>…</@_xsi:schemaLocation>`). Only ever called for
// the document root — a non-root element's attributes stay inline.
const bucketRootAttrs = (attrs: OpenTagAttrs): JsonObject => {
  const bucket: JsonObject = {}
  for (const key in attrs) bucket[`${ATTR_PREFIX}${key}`] = attrs[key]
  return bucket
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
// A byte order mark opening the file marks the encoding, not content: it is
// skipped, while one anywhere else is text a value holds.
const BYTE_ORDER_MARK = 0xfeff
const startOf = (xml: string): number =>
  xml.charCodeAt(0) === BYTE_ORDER_MARK ? 1 : 0

class DocumentScanner {
  private readonly xml: string
  private readonly stack: ElementFrame[]
  private pos: number
  private needsOracle = false
  private root: RootElement | undefined
  private rootAttributes: JsonObject = {}

  constructor(xml: string) {
    this.xml = xml
    this.pos = startOf(xml)
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
        ? { content: {}, rootAttributes: {} }
        : {
            content: { [this.root.name]: this.root.value },
            rootAttributes: this.rootAttributes,
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

  private scanText(): ScanOutcome | undefined {
    const next = this.xml.indexOf('<', this.pos)
    const end = next === -1 ? this.xml.length : next
    const text = trimXmlWhitespace(this.xml.slice(this.pos, end))
    this.pos = end
    if (text === '') return undefined
    if (this.isAtTopLevel()) return failed(CONTENT_OUTSIDE_ROOT)
    this.currentFrame().addText(text)
    return undefined
  }

  private isAtTopLevel(): boolean {
    return this.stack.length === 1
  }

  private scanClose(): ScanOutcome | undefined {
    const gt = this.xml.indexOf('>', this.pos + CLOSE_TAG_OPEN.length)
    if (gt === -1) return failed(UNTERMINATED_TAG)
    if (this.isAtTopLevel()) {
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
    if (this.isAtTopLevel()) {
      this.root = { name, value }
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
    if (end === -1) return failed(UNTERMINATED_COMMENT)
    if (this.isAtTopLevel()) return failed(CONTENT_OUTSIDE_ROOT)
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
    if (end === -1) return failed(UNTERMINATED_DECLARATION)
    if (this.isAtTopLevel()) return failed(CONTENT_OUTSIDE_ROOT)
    const content = trimXmlWhitespace(
      this.xml.slice(this.pos + CDATA_OPEN.length, end)
    )
    this.currentFrame().addChild(CDATA_PROP_NAME, content)
    this.pos = end + CDATA_CLOSE.length
    return undefined
  }

  private scanDeclaration(): ScanOutcome | undefined {
    const end = findTagEnd(this.xml, this.pos)
    if (end === -1) return failed(UNTERMINATED_DECLARATION)
    // A rewrite of the document would drop it, so it is refused wherever it is
    return failed(
      this.isAtTopLevel() ? CONTENT_OUTSIDE_ROOT : DECLARATION_IN_ROOT
    )
  }

  private scanProcessingInstruction(): ScanOutcome | undefined {
    const end = this.xml.indexOf(PI_CLOSE, this.pos + PI_OPEN.length)
    if (end === -1) return failed(UNTERMINATED_PROCESSING_INSTRUCTION)
    const refusal = this.refusalOfInstruction()
    if (refusal !== undefined) return failed(refusal)
    this.pos = end + PI_CLOSE.length
    return undefined
  }

  // The only instruction a rewrite of the document keeps is the XML
  // declaration that opens it: any other would be dropped.
  private refusalOfInstruction(): string | undefined {
    if (!this.isAtTopLevel()) return PROCESSING_INSTRUCTION_IN_ROOT
    if (!this.isXmlDeclaration()) return CONTENT_OUTSIDE_ROOT
    return this.pos === startOf(this.xml)
      ? undefined
      : MISPLACED_XML_DECLARATION
  }

  // The target is `xml` alone: `xml-stylesheet` and `xmlfoo` are other
  // instructions, which a rewrite of the document would drop.
  private isXmlDeclaration(): boolean {
    const target = this.pos + PI_OPEN.length
    if (!this.xml.startsWith(XML_DECLARATION_TARGET, target)) return false
    const after = this.xml.charCodeAt(target + XML_DECLARATION_TARGET.length)
    return after === QMARK || isXmlWhitespace(after)
  }

  private scanOpenTag(): ScanOutcome | undefined {
    const lexed = lexOpenTag(this.xml, this.pos)
    if (lexed.kind === 'unterminated') return failed(UNTERMINATED_TAG)
    if (lexed.kind === 'malformed') return failed(MALFORMED_ATTRIBUTE)
    if (lexed.kind === 'malformed-name') {
      return failed(MALFORMED_ELEMENT_NAME)
    }
    if (this.hasRoot()) return failed(CONTENT_OUTSIDE_ROOT)
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

  private hasRoot(): boolean {
    return this.isAtTopLevel() && this.root !== undefined
  }

  private buildFrame(lexed: LexedOpenTag): ElementFrame {
    if (!this.isAtTopLevel()) return new ElementFrame(lexed.name, lexed)
    this.rootAttributes = bucketRootAttrs(lexed.attrs)
    return new ElementFrame(lexed.name, NO_ATTRS)
  }
}

export const scanDocument = (xml: string): ScanOutcome =>
  new DocumentScanner(xml).run()
