import {
  CR,
  EQ,
  GT,
  isAsciiLetter,
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

export type LexOpenTagResult = LexedOpenTag | UnterminatedOpenTag

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
  if (close < 0) return null
  return { end: close + 1, value: xml.slice(pos + 1, close) }
}

interface AttrValue {
  readonly end: number
  readonly value: string | null
  readonly strayQuote: boolean
}

// `pos` is the position right after `=`. A quoted value keeps its
// interior quotes and `>` as data (rule 10) — only an unquoted run is
// checked for a stray quote.
const lexAttrValue = (xml: string, pos: number): AttrValue | null => {
  const afterEq = skipWhitespace(xml, pos)
  const quoteCode = xml.charCodeAt(afterEq)
  if (isQuote(quoteCode)) {
    const quoted = lexQuotedValue(xml, afterEq)
    if (quoted === null) return null
    return { end: quoted.end, value: quoted.value, strayQuote: false }
  }
  if (afterEq >= xml.length || quoteCode === GT) {
    return { end: afterEq, value: null, strayQuote: false }
  }
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
const lexAttr = (xml: string, start: number): AttrStep | null => {
  const nameRun = scanStopRun(xml, start)
  const name = xml.slice(start, nameRun.end)
  const afterName = skipWhitespace(xml, nameRun.end)
  if (xml.charCodeAt(afterName) !== EQ) {
    return { end: afterName, name, value: null, strayQuote: nameRun.strayQuote }
  }
  const attrValue = lexAttrValue(xml, afterName + 1)
  if (attrValue === null) return null
  return {
    end: attrValue.end,
    name,
    value: attrValue.value,
    strayQuote: nameRun.strayQuote || attrValue.strayQuote,
  }
}

// One step of the attribute loop at `pos`: either one attribute (when
// `pos` is an ASCII letter) or one skipped char — a quote there is the
// "skipped position" stray-quote raiser.
const stepAttrs = (xml: string, pos: number): AttrStep | null => {
  const charCode = xml.charCodeAt(pos)
  if (!isAsciiLetter(charCode)) {
    return {
      end: pos + 1,
      name: null,
      value: null,
      strayQuote: isQuote(charCode),
    }
  }
  return lexAttr(xml, pos)
}

interface AttrLoopResult {
  readonly end: number
  readonly attrs: Record<string, string | null>
  readonly hasAttrs: boolean
  readonly strayQuote: boolean
}

const lexAttrs = (xml: string, start: number): AttrLoopResult | null => {
  const attrs: Record<string, string | null> = Object.create(null)
  let hasAttrs = false
  let strayQuote = false
  let pos = start
  while (pos < xml.length && xml.charCodeAt(pos) !== GT) {
    const step = stepAttrs(xml, pos)
    if (step === null) return null
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
  const name = xml.slice(pos + 1, nameRun.end)
  const attrsResult = lexAttrs(xml, nameRun.end)
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
