import { EOL } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  addRule,
  getMerge,
  parse,
  ruleWithAttr,
  ruleWithoutAttr,
  serialise,
} from '../../../src/utils/gitAttributesFile.js'

describe('gitAttributesFile.parse', () => {
  describe('empty / absent input', () => {
    it('Given an empty string, When parsing, Then returns zero lines with os.EOL and a trailing newline', () => {
      // Arrange
      const input = ''

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.lines).toEqual([])
      expect(sut.eol).toBe(EOL)
      expect(sut.hasTrailingNewline).toBe(true)
    })

    it('Given a single "\\n" string, When parsing, Then yields one blank line', () => {
      // Arrange
      const input = '\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.eol).toBe('\n')
      expect(sut.lines).toHaveLength(1)
      expect(sut.lines[0]).toMatchObject({ kind: 'blank' })
      expect(sut.hasTrailingNewline).toBe(true)
    })
  })

  describe('EOL detection', () => {
    it('Given an LF file, When parsing, Then detects "\\n"', () => {
      // Arrange
      const input = '* text=auto\n*.sh text\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.eol).toBe('\n')
      expect(sut.hasTrailingNewline).toBe(true)
      expect(sut.lines).toHaveLength(2)
    })

    it('Given a CRLF file, When parsing, Then detects "\\r\\n"', () => {
      // Arrange
      const input = '* text=auto\r\n*.sh text\r\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.eol).toBe('\r\n')
      expect(sut.hasTrailingNewline).toBe(true)
    })

    it('Given a mixed-EOL file with CRLF present, When parsing, Then prefers "\\r\\n"', () => {
      // Arrange — CRLF wins because it's safer to normalise to CRLF on Windows
      const input = '* text=auto\r\n*.sh text\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.eol).toBe('\r\n')
    })

    it('Given a file without trailing newline, When parsing, Then hasTrailingNewline is false', () => {
      // Arrange
      const input = '* text=auto'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.hasTrailingNewline).toBe(false)
      expect(sut.lines).toHaveLength(1)
    })

    it('Given a non-empty string with NO newline at all, When parsing, Then falls back to os.EOL', () => {
      // Kills ConditionalExpression mutants on `if (text.includes('\n'))`
      // and the StringLiteral mutant `text.includes('')`.
      const input = '* text=auto'

      // Act
      const sut = parse(input)

      // Assert — on POSIX EOL is '\n'; on Windows it's '\r\n'. Assert
      // the contract abstractly: the returned EOL is os.EOL.
      expect(sut.eol).toBe(EOL)
    })
  })

  describe('rule parsing', () => {
    it('Given a bare attribute token, When parsing, Then attrs carries true', () => {
      // Arrange
      const input = '*.sh text\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      expect(rule.kind).toBe('rule')
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('*.sh')
      expect(rule.attrs.get('text')).toBe(true)
    })

    it('Given a "-attr" token, When parsing, Then attrs carries false', () => {
      // Arrange
      const input = '*.bin -text\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.attrs.get('text')).toBe(false)
    })

    it('Given an "!attr" token after an "attr=value", When parsing, Then the attr is unset in the map', () => {
      // Arrange — !attr means "unspecified" per git docs; we model that
      // as a removal from the parsed attrs map so downstream planners
      // see the same final state git would.
      const input = '*.xml merge=salesforce-source !merge\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.attrs.has('merge')).toBe(false)
    })

    it('Given an "attr=value" token, When parsing, Then attrs carries the string value', () => {
      // Arrange
      const input = '*.xml merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('*.xml')
      expect(rule.attrs.get('merge')).toBe('salesforce-source')
    })

    it('Given a line with multiple attributes, When parsing, Then all are captured', () => {
      // Arrange
      const input =
        '*.profile-meta.xml text=auto eol=lf merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.attrs.get('text')).toBe('auto')
      expect(rule.attrs.get('eol')).toBe('lf')
      expect(rule.attrs.get('merge')).toBe('salesforce-source')
    })

    it('Given a quoted pattern, When parsing, Then strips the surrounding quotes', () => {
      // Arrange
      const input = '"*.profile-meta.xml" merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('*.profile-meta.xml')
    })

    it('Given an unquoted pattern, When parsing, Then no quotes are stripped (pattern stays as-is)', () => {
      // Arrange — guards the two StringLiteral mutants on the
      // `startsWith('"') && endsWith('"')` checks by proving both
      // sides of the conditional fire when quotes ARE present and
      // neither incorrectly fires when they aren't.
      const input = '*.profile-meta.xml merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('*.profile-meta.xml')
      // Sanity: the literal double-quote is NOT part of the pattern
      expect(rule.pattern.includes('"')).toBe(false)
    })

    it('Given a pattern starting with " but not ending with " (malformed quoting), When parsing, Then the quote is preserved (no half-strip)', () => {
      // Kills the endsWith('"') → endsWith("") mutation, which would
      // make every pattern look quote-terminated and wrongly strip.
      const input = '"*.profile-meta.xml merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern.startsWith('"')).toBe(true)
    })

    it('Given a pattern ending with " but not starting with " (malformed quoting), When parsing, Then the quote is preserved', () => {
      // Kills the startsWith('"') → startsWith("") mutation.
      const input = '*.profile-meta.xml" merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern.endsWith('"')).toBe(true)
    })

    it('Given a single-character quoted pattern "x", When parsing, Then quotes ARE stripped (length 3 passes >= 2)', () => {
      // Kills the `>= 2` → `> 2` mutation by asserting stripping works
      // at the boundary. "x" has length 3, well above 2.
      const input = '"x" merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('x')
    })

    it("Given a one-character pattern '\"' (length 1), When parsing, Then it is NOT mistaken for an empty quoted pattern", () => {
      // Kills the `pattern.length >= 2` guard mutations: without it,
      // `startsWith('"') && endsWith('"')` would both be true for the
      // single-character string `"` and the slice(1, -1) would produce
      // an empty pattern. The >=2 guard prevents this.
      const input = '" merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert — the literal `"` stays (not stripped to '').
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('"')
    })

    it('Given a two-character pattern \'""\' (empty quoted pattern of length exactly 2), When parsing, Then the quotes are stripped to yield an empty pattern', () => {
      // Boundary test for `pattern.length >= 2`: at length 2, the
      // guard fires (>= passes, > fails). This kills the `>` mutation
      // which would leave the literal `""` as the pattern.
      const input = '"" merge=salesforce-source\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert — at length exactly 2, quotes are stripped; pattern
      // becomes the empty string (odd but correct per the spec).
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.pattern).toBe('')
    })

    it('Given multiple whitespace separators, When parsing, Then tokenises correctly (no empty attr tokens)', () => {
      // Arrange — uses tab + double space + triple space. If the
      // regex mutates to /\s/ (single-char), split produces empty
      // tokens between consecutive whitespace, which would be parsed
      // as zero-length attr names.
      const input = '*.xml\t  merge=salesforce-source   text\n'

      // Act
      const sut = parse(input)
      const rule = sut.lines[0]

      // Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(rule.attrs.get('merge')).toBe('salesforce-source')
      expect(rule.attrs.get('text')).toBe(true)
      // Kill /\s+/ → /\s/ mutation: no zero-length attribute names.
      expect(rule.attrs.has('')).toBe(false)
      // And the attrs map has exactly what we expect, nothing extra.
      expect(Array.from(rule.attrs.keys()).sort()).toEqual(['merge', 'text'])
    })
  })

  describe('comment and blank handling', () => {
    it('Given a comment line, When parsing, Then classifies as comment preserving raw', () => {
      // Arrange
      const input = '# a comment\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.lines[0]).toMatchObject({
        kind: 'comment',
        raw: '# a comment',
      })
    })

    it('Given a blank line, When parsing, Then classifies as blank', () => {
      // Arrange — three lines, middle one blank
      const input = '*.xml text\n\n*.sh text\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.lines).toHaveLength(3)
      expect(sut.lines[1]).toMatchObject({ kind: 'blank' })
    })

    it('Given a line with only whitespace, When parsing, Then classifies as blank', () => {
      // Arrange
      const input = '   \t  \n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.lines[0].kind).toBe('blank')
    })
  })

  describe('malformed lines', () => {
    it('Given a pattern-only line (no attributes), When parsing, Then classifies as malformed and preserves raw', () => {
      // Arrange
      const input = '*.xml\n'

      // Act
      const sut = parse(input)

      // Assert
      expect(sut.lines[0]).toMatchObject({ kind: 'malformed', raw: '*.xml' })
    })
  })
})

describe('gitAttributesFile.serialise', () => {
  describe('round-trip invariants (A1-A10)', () => {
    const fixtures: Array<[label: string, input: string]> = [
      ['A2 empty with newline', '\n'],
      ['A3 non-overlapping rules', '* text=auto eol=lf\n*.sh text eol=lf\n'],
      [
        'A4 our exact rules',
        '*.profile-meta.xml merge=salesforce-source\n*.permissionset-meta.xml merge=salesforce-source\n',
      ],
      [
        'A5 our rules + a legacy one',
        '*.profile-meta.xml merge=salesforce-source\n*.dropped-meta.xml merge=salesforce-source\n',
      ],
      [
        'A6 other driver on our glob',
        '*.profile-meta.xml merge=some-other-tool\n',
      ],
      [
        'A7 non-merge attrs on our glob',
        '*.profile-meta.xml text=auto eol=lf\n',
      ],
      [
        'A8 combined line (user attrs + our merge)',
        '*.profile-meta.xml text=auto merge=salesforce-source\n',
      ],
      [
        'A9 commented out driver',
        '# *.profile-meta.xml merge=salesforce-source\n',
      ],
      ['A10 CRLF', '*.profile-meta.xml merge=salesforce-source\r\n'],
      ['blank + comments + rules', '# header\n\n*.xml text=auto\n\n# done\n'],
      ['no trailing newline', '*.xml text=auto'],
    ]

    it.each(fixtures)('%s round-trips byte-for-byte', (_label, input) => {
      // Act
      const parsed = parse(input)
      const output = serialise(parsed)

      // Assert
      expect(output).toBe(input)
    })
  })
})

describe('gitAttributesFile.serialise — edge cases', () => {
  it('Given a parsed empty file, When serialising, Then returns empty string (no EOL)', () => {
    // Arrange
    const pf = parse('')

    // Act
    const out = serialise(pf)

    // Assert
    expect(out).toBe('')
  })
})

describe('gitAttributesFile helpers', () => {
  describe('getMerge', () => {
    it('Given a rule line with merge=X, Then returns X', () => {
      // Arrange
      const rule = parse('*.xml merge=foo\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(getMerge(rule)).toBe('foo')
    })

    it('Given a rule line without a merge attribute, Then returns undefined', () => {
      // Arrange
      const rule = parse('*.xml text=auto\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(getMerge(rule)).toBeUndefined()
    })

    it('Given a rule line with merge token (no value), Then returns undefined (bare merge is invalid)', () => {
      // Arrange
      const rule = parse('*.xml merge\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      expect(getMerge(rule)).toBeUndefined()
    })
  })

  describe('addRule', () => {
    it('Given a parsed file, When adding a rule, Then the new line is appended and serialisation includes it', () => {
      // Arrange
      const pf = parse('* text=auto\n')

      // Act
      const next = addRule(pf, '*.profile-meta.xml', [
        ['merge', 'salesforce-source'],
      ])
      const out = serialise(next)

      // Assert
      expect(out).toBe(
        '* text=auto\n*.profile-meta.xml merge=salesforce-source\n'
      )
    })

    it('Given a file without a trailing newline, When adding a rule, Then the result ends with the detected EOL and the new rule on its own line', () => {
      // Arrange — detected EOL is os.EOL when the file has no newlines
      const pf = parse('* text=auto')

      // Act
      const next = addRule(pf, '*.xml', [['merge', 'salesforce-source']])
      const out = serialise(next)

      // Assert — existing line gets terminated, new line is appended
      expect(out).toBe(
        `* text=auto${pf.eol}*.xml merge=salesforce-source${pf.eol}`
      )
    })

    it('Given a CRLF file, When adding a rule, Then the new line uses CRLF', () => {
      // Arrange
      const pf = parse('* text=auto\r\n')

      // Act
      const next = addRule(pf, '*.xml', [['merge', 'salesforce-source']])
      const out = serialise(next)

      // Assert
      expect(out).toBe('* text=auto\r\n*.xml merge=salesforce-source\r\n')
    })

    it('Given a bare-true attribute, When adding a rule, Then the rule is written without "=value"', () => {
      // Arrange
      const pf = parse('')

      // Act — e.g. pattern carries only the `text` attribute
      const next = addRule(pf, '*.sh', [['text', true]])
      const out = serialise(next)

      // Assert
      expect(out).toContain('*.sh text')
      expect(out).not.toContain('*.sh text=')
    })

    it('Given a false attribute, When adding a rule, Then the rule is written with "-attr"', () => {
      // Arrange
      const pf = parse('')

      // Act — `-text` marks the glob as binary
      const next = addRule(pf, '*.bin', [['text', false]])
      const out = serialise(next)

      // Assert
      expect(out).toContain('*.bin -text')
    })
  })

  describe('ruleWithoutAttr', () => {
    it('Given a rule with merge + string attr, When removing merge, Then the rule keeps the string attr and drops merge', () => {
      // Arrange
      const rule = parse(
        '*.profile-meta.xml text=auto merge=salesforce-source\n'
      ).lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithoutAttr(rule, 'merge')
      expect(next.attrs.has('merge')).toBe(false)
      expect(next.attrs.get('text')).toBe('auto')
      expect(next.raw).toBe('*.profile-meta.xml text=auto')
    })

    it('Given a rule with merge + bare-true attr, When removing merge, Then the raw serialises the bare attr correctly', () => {
      // Arrange
      const rule = parse('*.profile-meta.xml binary merge=salesforce-source\n')
        .lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithoutAttr(rule, 'merge')
      expect(next.raw).toBe('*.profile-meta.xml binary')
    })

    it('Given a rule with merge + negated attr, When removing merge, Then the raw serialises the negated attr correctly', () => {
      // Arrange
      const rule = parse('*.profile-meta.xml -text merge=salesforce-source\n')
        .lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithoutAttr(rule, 'merge')
      expect(next.raw).toBe('*.profile-meta.xml -text')
    })
  })

  describe('ruleWithAttr', () => {
    it('Given a rule without the attribute, When setting it, Then the raw gains the new token at the end', () => {
      // Arrange
      const rule = parse('*.profile-meta.xml text=auto\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithAttr(rule, 'merge', 'salesforce-source')
      expect(next.attrs.get('merge')).toBe('salesforce-source')
      expect(next.raw).toBe(
        '*.profile-meta.xml text=auto merge=salesforce-source'
      )
    })

    it('Given a rule that already has the attribute, When setting it again, Then the existing value is replaced (no duplicate token)', () => {
      // Arrange — overwrite from some-other-tool to salesforce-source
      const rule = parse('*.profile-meta.xml merge=some-other-tool\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithAttr(rule, 'merge', 'salesforce-source')
      expect(next.attrs.get('merge')).toBe('salesforce-source')
      const mergeTokens = next.raw.match(/merge=/g) ?? []
      expect(mergeTokens).toHaveLength(1)
    })

    it('Given a rule, When setting a bare-true attribute, Then the raw ends with the attr name alone', () => {
      // Arrange
      const rule = parse('* text=auto\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithAttr(rule, 'binary', true)
      expect(next.raw).toBe('* text=auto binary')
    })

    it('Given a rule, When setting a negated attribute, Then the raw uses the "-attr" form', () => {
      // Arrange
      const rule = parse('* text=auto\n').lines[0]

      // Act + Assert
      if (rule.kind !== 'rule') throw new Error('unreachable')
      const next = ruleWithAttr(rule, 'executable', false)
      expect(next.raw).toBe('* text=auto -executable')
    })
  })
})
