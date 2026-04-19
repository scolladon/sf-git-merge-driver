import { describe, expect, it } from 'vitest'
import { parsePromptAnswer } from '../../../src/commands/git/merge/driver/install.js'

/**
 * Direct tests for the pure helpers exported by the install command.
 * The oclif `run()` method is NUT-only, but everything non-oclif is
 * factored out so it CAN be unit-tested — starting here.
 */
describe('install command — parsePromptAnswer', () => {
  describe('skip', () => {
    it.each([
      ['s', 'skip'],
      ['S', 'skip'],
      ['skip', 'skip'],
      ['SKIP', 'skip'],
      ['Skip', 'skip'],
      ['  skip  ', 'skip'], // whitespace tolerance
    ] as const)('Given answer %s, When parsing, Then returns %s', (input, expected) => {
      expect(parsePromptAnswer(input)).toBe(expected)
    })
  })

  describe('overwrite', () => {
    it.each([
      ['o', 'overwrite'],
      ['O', 'overwrite'],
      ['overwrite', 'overwrite'],
      ['OVERWRITE', 'overwrite'],
      ['Overwrite', 'overwrite'],
      ['  overwrite  ', 'overwrite'],
    ] as const)('Given answer %s, When parsing, Then returns %s', (input, expected) => {
      expect(parsePromptAnswer(input)).toBe(expected)
    })
  })

  describe('abort (default)', () => {
    it.each([
      'a',
      'abort',
      '', // empty (user hit return)
      '   ', // whitespace only
      'yes',
      'maybe',
      'o\tsomething', // tab-prefixed or extra content
      'sx', // starts-with variants should NOT match
      'os',
    ])('Given ambiguous or unrecognised answer %s, When parsing, Then defaults to abort', input => {
      expect(parsePromptAnswer(input)).toBe('abort')
    })
  })
})
