import { BANG, QMARK, SLASH } from './charCodes.js'
import {
  UNTERMINATED_COMMENT,
  UNTERMINATED_DECLARATION,
  UNTERMINATED_PROCESSING_INSTRUCTION,
  UNTERMINATED_TAG,
  unbalancedTags,
} from './parseErrors.js'
import {
  CDATA_CLOSE,
  CDATA_OPEN,
  COMMENT_CLOSE,
  COMMENT_OPEN,
  PI_CLOSE,
  PI_OPEN,
} from './xmlTokens.js'

// Quote-aware scan for the next unescaped `>` that closes a tag
// starting at `from` (the position of the `<`). Walks past `>` chars
// that appear inside `"..."` or `'...'` attribute values. Without this
// guard, `<el attr="a>b">` would be split mid-attribute by a naive
// `indexOf('>')` and the resulting `tagBody` would falsely trigger the
// unbalanced-tags check on otherwise valid XML.
export const findTagEnd = (xml: string, from: number): number => {
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

// A CDATA section starting at `next` (the position of `<`), skipped up
// to and including its own `]]>`. Returns -1 when no closing `]]>`
// follows, so the caller falls through to the generic `<! ... >`
// branch — the same outcome the previous prepass produced for an
// unterminated section (it never rewrote one).
const skipCdata = (xml: string, next: number): number => {
  if (!xml.startsWith(CDATA_OPEN, next)) return -1
  const end = xml.indexOf(CDATA_CLOSE, next + CDATA_OPEN.length)
  return end < 0 ? -1 : end + CDATA_CLOSE.length
}

// Resume index for a `<!…` or `<?…` declaration starting at `next`
// (the position of `<`). Covers `<![CDATA[ … ]]>`, `<!-- comment -->`,
// `<!DOCTYPE …>` / `<!ENTITY …>` / etc, and `<?xml ... ?>` processing
// instructions. None of these contribute to element nesting.
const skipDeclaration = (xml: string, next: number, c1: number): number => {
  if (c1 === BANG) {
    const cdataEnd = skipCdata(xml, next)
    if (cdataEnd >= 0) return cdataEnd
    if (xml.startsWith(COMMENT_OPEN, next)) {
      const end = xml.indexOf(COMMENT_CLOSE, next + COMMENT_OPEN.length)
      if (end < 0) throw new Error(UNTERMINATED_COMMENT)
      return end + COMMENT_CLOSE.length
    }
    const end = findTagEnd(xml, next)
    if (end < 0) throw new Error(UNTERMINATED_DECLARATION)
    return end + 1
  }
  const end = xml.indexOf(PI_CLOSE, next + PI_OPEN.length)
  if (end < 0) throw new Error(UNTERMINATED_PROCESSING_INSTRUCTION)
  return end + PI_CLOSE.length
}

// Cursors for the next double/single quote at or after the scan point,
// local to one assertBalancedTags call. The scan point only moves
// forward, so refreshing each lazily (only once it falls behind `next`)
// keeps the whole pass O(n) even on documents with no quotes after the
// root element — the common Salesforce shape.
interface QuoteCursors {
  dq: number
  sq: number
}

// End of an element tag starting at `next`, or -1 when no `>` follows
// (a -1 fails both `< tagEnd` quote checks and flows straight out).
// The native `indexOf('>')` is correct unless a quote lies inside the
// tag (an attribute value containing `>`), in which case only the
// quote-aware findTagEnd scan is safe.
const elementTagEnd = (
  xml: string,
  next: number,
  quotes: QuoteCursors
): number => {
  const tagEnd = xml.indexOf('>', next + 1)
  if (quotes.dq !== -1 && quotes.dq < next) quotes.dq = xml.indexOf('"', next)
  if (quotes.sq !== -1 && quotes.sq < next) quotes.sq = xml.indexOf("'", next)
  const quoteInsideTag =
    (quotes.dq !== -1 && quotes.dq < tagEnd) ||
    (quotes.sq !== -1 && quotes.sq < tagEnd)
  return quoteInsideTag ? findTagEnd(xml, next + 1) : tagEnd
}

// Whole-document well-formedness pass: track open-vs-close tag depth
// and throw on mismatch. The scanner only runs it when its own single
// pass cannot settle the outcome alone (stray quotes, short comments, a
// top-level close tag) or has already failed — in the latter case the
// balance-family message takes precedence over the scanner's.
// MergeDriver relies on the throw to surface a parse failure as a
// merge conflict.
export const assertBalancedTags = (xml: string): void => {
  let depth = 0
  let i = 0
  const quotes: QuoteCursors = { dq: xml.indexOf('"'), sq: xml.indexOf("'") }
  while (i < xml.length) {
    const next = xml.indexOf('<', i)
    if (next < 0) break
    const c1 = xml.charCodeAt(next + 1)
    if (c1 === BANG || c1 === QMARK) {
      i = skipDeclaration(xml, next, c1)
      continue
    }
    const tagEnd = elementTagEnd(xml, next, quotes)
    if (tagEnd < 0) throw new Error(UNTERMINATED_TAG)
    if (c1 === SLASH) {
      depth--
    } else if (xml.charCodeAt(tagEnd - 1) !== SLASH) {
      depth++
    }
    // self-closing `<x/>` does not change depth
    i = tagEnd + 1
  }
  if (depth !== 0) {
    throw new Error(unbalancedTags(depth))
  }
}
