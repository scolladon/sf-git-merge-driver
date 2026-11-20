// charCodeAt values the scanner dispatches on. Comparing char codes
// instead of slicing/startsWith substrings avoids an allocation per
// tag on the hot path (mirrors the previous parser's convention).
export const LT = 60 // '<'
export const GT = 62 // '>'
export const SLASH = 47 // '/'
export const BANG = 33 // '!'
export const QMARK = 63 // '?'
export const EQ = 61 // '='
const DQ = 34 // '"'
const SQ = 39 // "'"
export const SPACE = 32 // ' '
export const TAB = 9 // '\t'
export const LF = 10 // '\n'
export const CR = 13 // '\r'

const UPPER_A = 65
const UPPER_Z = 90
const LOWER_A = 97
const LOWER_Z = 122

// Stop set for an element or attribute name run: whitespace, the tag
// terminator, self-close slash and the attribute assignment sign.
export const isNameStop = (charCode: number): boolean =>
  charCode === SPACE ||
  charCode === CR ||
  charCode === LF ||
  charCode === TAB ||
  charCode === GT ||
  charCode === SLASH ||
  charCode === EQ

// XML whitespace is these four characters only. String.prototype.trim also
// strips the no-break space, the byte order mark and the Unicode separators,
// which are text a value holds (a label ending in a no-break space).
export const isXmlWhitespace = (charCode: number): boolean =>
  charCode === SPACE || charCode === TAB || charCode === LF || charCode === CR

// Stryker disable ConditionalExpression,EqualityOperator: the bound checks only stop the walks at the ends, and a char code read past an end is NaN, which is no whitespace; a walk that crosses the other leaves a slice of the empty string
export const trimXmlWhitespace = (text: string): string => {
  let start = 0
  let end = text.length
  while (start < end && isXmlWhitespace(text.charCodeAt(start))) start++
  while (end > start && isXmlWhitespace(text.charCodeAt(end - 1))) end--
  return text.slice(start, end)
}
// Stryker restore ConditionalExpression,EqualityOperator

export const isAsciiLetter = (charCode: number): boolean =>
  (charCode >= UPPER_A && charCode <= UPPER_Z) ||
  (charCode >= LOWER_A && charCode <= LOWER_Z)

export const isQuote = (charCode: number): boolean =>
  charCode === DQ || charCode === SQ

const UNDERSCORE = 95
const COLON = 58
const FIRST_NON_ASCII = 128

// What an XML name may start with: an ASCII letter, `_`, `:` or a
// non-ASCII char.
export const isNameStartChar = (charCode: number): boolean =>
  isAsciiLetter(charCode) ||
  charCode === UNDERSCORE ||
  charCode === COLON ||
  charCode >= FIRST_NON_ASCII
