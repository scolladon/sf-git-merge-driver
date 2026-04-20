import { EOL } from 'node:os'

/**
 * Structured view of `.git/info/attributes`. Parsing is lossless for the
 * file shapes we need to handle — comments, blanks, rules, and malformed
 * lines are preserved with their raw text so `serialise(parse(x))` is
 * byte-for-byte equal to `x` for any well-formed input.
 *
 * Attribute semantics follow `git help attributes`:
 *   `attr`       → true   (attribute set)
 *   `-attr`      → false  (attribute unset)
 *   `!attr`      → deleted from the map (unspecified)
 *   `attr=value` → string value
 *
 * We parse enough to reason about merge-driver state; we do NOT attempt
 * glob matching — all pattern comparisons are literal string equality
 * against the plugin's known pattern set.
 */

export type AttrValue = string | true | false

export type BlankLine = { readonly kind: 'blank'; readonly raw: string }
export type CommentLine = { readonly kind: 'comment'; readonly raw: string }
export type RuleLine = {
  readonly kind: 'rule'
  readonly pattern: string
  readonly attrs: ReadonlyMap<string, AttrValue>
  readonly raw: string
}
export type MalformedLine = { readonly kind: 'malformed'; readonly raw: string }

export type Line = BlankLine | CommentLine | RuleLine | MalformedLine

export type ParsedFile = {
  readonly lines: readonly Line[]
  readonly eol: '\n' | '\r\n'
  readonly hasTrailingNewline: boolean
}

const COMMENT_PREFIX = '#'

// Narrow cast — `node:os` types `EOL` as `string`, but at runtime it is
// always `'\n'` (POSIX) or `'\r\n'` (Windows). Casting here keeps
// `detectEol` branch-free and avoids a platform-dependent ternary that
// tests on one OS can never cover.
const OS_DEFAULT_EOL = EOL as '\n' | '\r\n'

const detectEol = (text: string): '\n' | '\r\n' => {
  if (text.includes('\r\n')) return '\r\n'
  if (text.includes('\n')) return '\n'
  // Fresh/empty file — match the host's native newline.
  return OS_DEFAULT_EOL
}

const stripQuotes = (pattern: string): string => {
  if (pattern.length >= 2 && pattern.startsWith('"') && pattern.endsWith('"')) {
    return pattern.slice(1, -1)
  }
  return pattern
}

const parseAttrToken = (
  token: string
): { name: string; value: AttrValue } | { name: string; remove: true } => {
  if (token.startsWith('!')) {
    return { name: token.slice(1), remove: true }
  }
  if (token.startsWith('-')) {
    return { name: token.slice(1), value: false }
  }
  const eq = token.indexOf('=')
  if (eq === -1) {
    return { name: token, value: true }
  }
  return { name: token.slice(0, eq), value: token.slice(eq + 1) }
}

const parseLine = (raw: string): Line => {
  // We parse the raw line as given; caller splits on EOL first.
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { kind: 'blank', raw }
  }
  if (trimmed.startsWith(COMMENT_PREFIX)) {
    return { kind: 'comment', raw }
  }
  // Tokenise on whitespace runs. Quoted patterns with spaces are rare in
  // practice for this tool's globs, but the parser handles the common
  // double-quote case at token boundaries.
  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 2) {
    // Pattern with no attributes is malformed per git's grammar.
    return { kind: 'malformed', raw }
  }
  const [rawPattern, ...attrTokens] = tokens
  const pattern = stripQuotes(rawPattern as string)
  const attrs = new Map<string, AttrValue>()
  for (const token of attrTokens) {
    const parsed = parseAttrToken(token)
    if ('remove' in parsed) {
      attrs.delete(parsed.name)
    } else {
      attrs.set(parsed.name, parsed.value)
    }
  }
  return { kind: 'rule', pattern, attrs, raw }
}

export const parse = (text: string): ParsedFile => {
  if (text.length === 0) {
    return { lines: [], eol: detectEol(text), hasTrailingNewline: true }
  }
  const eol = detectEol(text)
  const hasTrailingNewline = text.endsWith(eol)
  const body = hasTrailingNewline ? text.slice(0, -eol.length) : text
  const rawLines = body.split(eol)
  const lines = rawLines.map(parseLine)
  return { lines, eol, hasTrailingNewline }
}

export const serialise = (file: ParsedFile): string => {
  if (file.lines.length === 0) return ''
  const body = file.lines.map(line => line.raw).join(file.eol)
  return file.hasTrailingNewline ? body + file.eol : body
}

/**
 * Read the merge-driver name set by a rule, or undefined if the rule has
 * no `merge=<value>` attribute. A bare `merge` token (no `=`) is treated
 * as invalid and returns undefined, matching git's own tolerance.
 */
export const getMerge = (rule: RuleLine): string | undefined => {
  const value = rule.attrs.get('merge')
  return typeof value === 'string' ? value : undefined
}

/**
 * Append a new rule to the parsed file. Preserves EOL and trailing-newline
 * policy: if the incoming file had no trailing newline, the existing last
 * line is terminated before the new rule is added so the result is still
 * parseable (and ends with the detected EOL for the new rule).
 */
export const addRule = (
  file: ParsedFile,
  pattern: string,
  attrs: readonly (readonly [string, AttrValue])[]
): ParsedFile => {
  const attrsMap = new Map<string, AttrValue>(attrs)
  const raw = serialiseRuleRaw(pattern, attrsMap)
  const ruleLine: RuleLine = { kind: 'rule', pattern, attrs: attrsMap, raw }
  return {
    lines: [...file.lines, ruleLine],
    eol: file.eol,
    // Terminating the new rule with EOL is equivalent to hasTrailingNewline=true.
    hasTrailingNewline: true,
  }
}

/**
 * Return a new RuleLine with the given attribute removed, keeping the
 * pattern and all other attributes intact. Used by uninstall planners to
 * strip `merge=<driver>` from combined lines without losing the user's
 * other attributes.
 */
export const ruleWithoutAttr = (rule: RuleLine, attrName: string): RuleLine => {
  const nextAttrs = new Map(rule.attrs)
  nextAttrs.delete(attrName)
  return {
    ...rule,
    attrs: nextAttrs,
    raw: serialiseRuleRaw(rule.pattern, nextAttrs),
  }
}

/**
 * Return a new RuleLine with the given attribute set to `value`. If the
 * attribute already exists on the rule it is overwritten (and the new
 * value is placed at the end of the serialised token order, matching
 * `addRule`'s output). Used by the install-time overwrite policy to
 * swap a conflicting driver to ours without losing the user's other
 * attributes on the same line.
 */
export const ruleWithAttr = (
  rule: RuleLine,
  attrName: string,
  value: AttrValue
): RuleLine => {
  const nextAttrs = new Map(rule.attrs)
  nextAttrs.delete(attrName)
  nextAttrs.set(attrName, value)
  return {
    ...rule,
    attrs: nextAttrs,
    raw: serialiseRuleRaw(rule.pattern, nextAttrs),
  }
}

const serialiseAttrToken = (name: string, value: AttrValue): string => {
  if (value === true) return name
  if (value === false) return `-${name}`
  return `${name}=${value}`
}

const serialiseRuleRaw = (
  pattern: string,
  attrs: ReadonlyMap<string, AttrValue>
): string => {
  const parts = [pattern]
  for (const [name, value] of attrs) {
    parts.push(serialiseAttrToken(name, value))
  }
  return parts.join(' ')
}
