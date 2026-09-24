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
export const DASH = 45 // '-'
export const LBRACKET = 91 // '['

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

export const isAsciiLetter = (charCode: number): boolean =>
  (charCode >= UPPER_A && charCode <= UPPER_Z) ||
  (charCode >= LOWER_A && charCode <= LOWER_Z)

export const isQuote = (charCode: number): boolean =>
  charCode === DQ || charCode === SQ
