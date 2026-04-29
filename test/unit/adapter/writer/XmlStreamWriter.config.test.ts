import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'

// These tests exercise the writer with MergeConfig shapes that differ
// from defaultConfig — specifically varying conflictMarkerSize and the
// tag strings. They complement the fixture-based parity tests (which
// always use defaultConfig) and catch regressions in the per-config
// buildConflictMarkers path.

const makeConfig = (overrides: Partial<MergeConfig>): MergeConfig => ({
  conflictMarkerSize: 7,
  ancestorConflictTag: 'base',
  localConflictTag: 'ours',
  otherConflictTag: 'theirs',
  ...overrides,
})

const CONFLICT = {
  __conflict: true as const,
  local: [{ v: 'L' }],
  ancestor: [{ v: 'A' }],
  other: [{ v: 'O' }],
}

describe('XmlStreamWriter configuration variants', () => {
  describe('given conflictMarkerSize=3', () => {
    it('when serialized then marker characters repeat 3 times, not 7', async () => {
      const writer = new XmlStreamWriter(makeConfig({ conflictMarkerSize: 3 }))
      const out = await serializeToString(writer, [CONFLICT as never], {})
      expect(out).toContain('<<< ours')
      expect(out).toContain('||| base')
      expect(out).toContain('===')
      expect(out).toContain('>>> theirs')
      // Exactly 3 <, not 4 or 7.
      expect(out).not.toContain('<<<<')
      expect(out).not.toContain('====')
    })
  })

  describe('given conflictMarkerSize=10', () => {
    it('when serialized then marker characters repeat 10 times', async () => {
      const writer = new XmlStreamWriter(makeConfig({ conflictMarkerSize: 10 }))
      const out = await serializeToString(writer, [CONFLICT as never], {})
      expect(out).toContain('<'.repeat(10) + ' ours')
      expect(out).toContain('|'.repeat(10) + ' base')
      expect(out).toContain('='.repeat(10))
      expect(out).toContain('>'.repeat(10) + ' theirs')
      // No eleventh repeat leakage.
      expect(out).not.toContain('<'.repeat(11))
    })
  })

  describe('given custom conflict tags', () => {
    it('when serialized then the tag names appear on the marker lines', async () => {
      const writer = new XmlStreamWriter(
        makeConfig({
          ancestorConflictTag: 'BASE_REV',
          localConflictTag: 'MY_BRANCH',
          otherConflictTag: 'INCOMING',
        })
      )
      const out = await serializeToString(writer, [CONFLICT as never], {})
      expect(out).toContain('<<<<<<< MY_BRANCH')
      expect(out).toContain('||||||| BASE_REV')
      expect(out).toContain('>>>>>>> INCOMING')
      expect(out).not.toContain('ours')
      expect(out).not.toContain('base')
      expect(out).not.toContain('theirs')
    })
  })

  describe('given conflictMarkerSize=1 and text content that starts with a single `<`', () => {
    it('when serialized then pass-1 must not confuse data with markers', async () => {
      // With markerSize=1, `<` on its own line looks like a marker prefix.
      // The line state machine must still handle the "text happens to
      // start with one `<`" case correctly.
      const writer = new XmlStreamWriter(makeConfig({ conflictMarkerSize: 1 }))
      const out = await serializeToString(
        writer,
        [{ Root: [{ v: '< starts-with-lt' }] }],
        {}
      )
      // Not a conflict block → the raw text must appear verbatim.
      expect(out).toContain('< starts-with-lt')
    })
  })
})
