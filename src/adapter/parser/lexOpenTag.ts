import {
  CR,
  EQ,
  GT,
  isAsciiLetter,
  isNameStartChar,
  isNameStop,
  isQuote,
  LF,
  SLASH,
  SPACE,
  TAB,
} from './charCodes.js'

export type OpenTagAttrs = Readonly<Record<string, string | null>>

export interface LexedOpenTag {
  readonly kind: 'tag'
  readonly name: string
  readonly attrs: OpenTagAttrs
  readonly hasAttrs: boolean
  readonly end: number
  readonly selfClosing: boolean
  readonly strayQuote: boolean
}

interface UnterminatedOpenTag {
  readonly kind: 'unterminated'
}

// A tag the writer could not round-trip: an attribute with no value, or
// whose name does not start with an ASCII letter (the lexer would truncate
// it to its first letter, `__proto__` read as `proto__`), or a stray char
// between attributes.
interface MalformedOpenTag {
  readonly kind: 'malformed'
}

const MALFORMED: MalformedOpenTag = Object.freeze({ kind: 'malformed' })

const isMalformed = (outcome: object | null): outcome is MalformedOpenTag =>
  outcome === MALFORMED

// An element name that cannot start a name (`<=======>`).
interface MalformedElementName {
  readonly kind: 'malformed-name'
}

const MALFORMED_NAME: MalformedElementName = Object.freeze({
  kind: 'malformed-name',
})

export type LexOpenTagResult =
  | LexedOpenTag
  | UnterminatedOpenTag
  | MalformedOpenTag
  | MalformedElementName

interface StopRun {
  readonly end: number
  readonly strayQuote: boolean
}

// Scans a name or unquoted-value run to its stop char (or EOF),
// flagging a stray quote in the same pass so no second scan over the
// tag is needed.
const scanStopRun = (xml: string, start: number): StopRun => {
  let pos = start
  let strayQuote = false
  // Stryker disable next-line EqualityOperator: one step past EOF ends at length + 1, which every caller treats as EOF
  while (pos < xml.length && !isNameStop(xml.charCodeAt(pos))) {
    if (isQuote(xml.charCodeAt(pos))) strayQuote = true
    pos++
  }
  return { end: pos, strayQuote }
}

const isEqWhitespace = (charCode: number): boolean =>
  charCode === SPACE || charCode === TAB || charCode === LF || charCode === CR

const skipWhitespace = (xml: string, start: number): number => {
  let pos = start
  // Stryker disable next-line ConditionalExpression: charCodeAt past EOF is NaN, not whitespace, so the loop stops at length
  // Stryker disable next-line EqualityOperator: charCodeAt past EOF is NaN, not whitespace, so the loop stops at length
  while (pos < xml.length && isEqWhitespace(xml.charCodeAt(pos))) pos++
  return pos
}

interface QuotedValue {
  readonly end: number
  readonly value: string
}

// Reads up to the SAME quote char at `pos`. `null` means the closing
// quote is missing — the caller surfaces that as an unterminated tag.
const lexQuotedValue = (xml: string, pos: number): QuotedValue | null => {
  const quote = xml[pos]
  const close = xml.indexOf(quote, pos + 1)
  if (close === -1) return null
  return { end: close + 1, value: xml.slice(pos + 1, close) }
}

interface AttrValue {
  readonly end: number
  readonly value: string | null
  readonly strayQuote: boolean
}

// `pos` is the position right after `=`. A quoted value keeps its
// interior quotes and `>` as data — only an unquoted run is checked
// for a stray quote.
const lexAttrValue = (
  xml: string,
  pos: number
): AttrValue | MalformedOpenTag | null => {
  const afterEq = skipWhitespace(xml, pos)
  const quoteCode = xml.charCodeAt(afterEq)
  if (isQuote(quoteCode)) {
    const quoted = lexQuotedValue(xml, afterEq)
    if (quoted === null) return null
    return { end: quoted.end, value: quoted.value, strayQuote: false }
  }
  if (quoteCode === GT) return MALFORMED
  const run = scanStopRun(xml, afterEq)
  return {
    end: run.end,
    value: xml.slice(afterEq, run.end),
    strayQuote: run.strayQuote,
  }
}

interface AttrStep {
  readonly end: number
  readonly name: string | null
  readonly value: string | null
  readonly strayQuote: boolean
}

// One attribute, starting at an ASCII letter. `null` means an
// unterminated quoted value forced a bail-out.
const lexAttr = (
  xml: string,
  start: number
): AttrStep | MalformedOpenTag | null => {
  const nameRun = scanStopRun(xml, start)
  const name = xml.slice(start, nameRun.end)
  const afterName = skipWhitespace(xml, nameRun.end)
  if (xml.charCodeAt(afterName) !== EQ) return MALFORMED
  const attrValue = lexAttrValue(xml, afterName + 1)
  if (attrValue === null || isMalformed(attrValue)) return attrValue
  return {
    end: attrValue.end,
    name,
    value: attrValue.value,
    strayQuote: nameRun.strayQuote || attrValue.strayQuote,
  }
}

const skipped = (pos: number, strayQuote: boolean): AttrStep => ({
  end: pos + 1,
  name: null,
  value: null,
  strayQuote,
})

// A `/` is only tolerated as the self-close slash right before `>`.
const isSelfCloseSlash = (xml: string, pos: number): boolean =>
  xml.charCodeAt(pos) === SLASH && xml.charCodeAt(pos + 1) === GT

// One step of the attribute loop at `pos`: either one attribute (when
// `pos` is an ASCII letter) or one skipped char. Only whitespace, the
// self-close slash and a quote (the "skipped position" stray-quote raiser)
// may be skipped: any other char would be dropped silently, or glue
// the following name onto a stray prefix, so the tag is refused.
const stepAttrs = (
  xml: string,
  pos: number
): AttrStep | MalformedOpenTag | null => {
  const charCode = xml.charCodeAt(pos)
  if (isAsciiLetter(charCode)) return lexAttr(xml, pos)
  if (isQuote(charCode)) return skipped(pos, true)
  if (isEqWhitespace(charCode) || isSelfCloseSlash(xml, pos)) {
    return skipped(pos, false)
  }
  return MALFORMED
}

interface AttrLoopResult {
  readonly end: number
  readonly attrs: Record<string, string | null>
  readonly hasAttrs: boolean
  readonly strayQuote: boolean
}

const lexAttrs = (
  xml: string,
  start: number
): AttrLoopResult | MalformedOpenTag | null => {
  const attrs: Record<string, string | null> = Object.create(null)
  let hasAttrs = false
  let strayQuote = false
  let pos = start
  // Stryker disable next-line EqualityOperator: one step past EOF ends at length + 1, still reported unterminated
  while (pos < xml.length && xml.charCodeAt(pos) !== GT) {
    const step = stepAttrs(xml, pos)
    if (step === null || isMalformed(step)) return step
    if (step.name !== null) {
      attrs[step.name] = step.value
      hasAttrs = true
    }
    strayQuote = strayQuote || step.strayQuote
    pos = step.end
  }
  return { end: pos, attrs, hasAttrs, strayQuote }
}

// Element open-tag lexer. `pos` is the position of the `<`. Returns the
// tag lexed up to and including its `>`, or `{ kind: 'unterminated' }`
// when no `>` or no closing quote is found before EOF.
export const lexOpenTag = (xml: string, pos: number): LexOpenTagResult => {
  const nameRun = scanStopRun(xml, pos + 1)
  if (!isNameStartChar(xml.charCodeAt(pos + 1))) return MALFORMED_NAME
  const name = xml.slice(pos + 1, nameRun.end)
  const attrsResult = lexAttrs(xml, nameRun.end)
  // Stryker disable next-line ConditionalExpression: isMalformed(null) is false, the null check only narrows the type
  if (attrsResult !== null && isMalformed(attrsResult)) return MALFORMED
  if (attrsResult === null || attrsResult.end >= xml.length) {
    return { kind: 'unterminated' }
  }
  return {
    kind: 'tag',
    name,
    attrs: attrsResult.attrs,
    hasAttrs: attrsResult.hasAttrs,
    end: attrsResult.end + 1,
    selfClosing: xml.charCodeAt(attrsResult.end - 1) === SLASH,
    strayQuote: nameRun.strayQuote || attrsResult.strayQuote,
  }
}
