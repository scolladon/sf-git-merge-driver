import { describe, expect, it } from 'vitest'
import { listFixtures } from '../../../utils/goldenFile.js'

// The Zod-validated loader in test/utils/goldenFile.ts already throws
// on malformed fixture directories, so the harness sanity check is an
// aggregate pass rather than a per-fixture assertion. If any fixture
// is broken, `listFixtures()` throws and fails the first test — which
// is sufficient signal; per-fixture meta-assertions were ceremony.
describe('golden-file fixture harness', () => {
  describe('given the fixtures directory', () => {
    it('when loading then every fixture loads without throwing', () => {
      expect(() => listFixtures()).not.toThrow()
      expect(listFixtures().length).toBeGreaterThan(0)
    })

    it('when loading then every fixture has non-empty expected bytes (or is the designated empty case)', () => {
      const empty = listFixtures().filter(f => f.expectedCurrent.length === 0)
      expect(empty.map(f => f.id)).toEqual(['13-empty-output'])
    })

    it('when loading then every parity fixture has inputs (merge trio or ordered-input)', () => {
      const incomplete = listFixtures().filter(f => {
        const hasMerge =
          f.inputs.ancestor !== undefined &&
          f.inputs.ours !== undefined &&
          f.inputs.theirs !== undefined
        return !hasMerge && f.inputs.ordered === undefined
      })
      expect(incomplete.map(f => f.id)).toEqual([])
    })

    it('when a fixture declares divergence mode then expected-new.xml is populated', () => {
      const divergence = listFixtures().filter(
        f => f.parity.mode === 'divergence'
      )
      for (const f of divergence) {
        expect(f.expectedNew).toBeDefined()
        expect(f.expectedNew!.length).toBeGreaterThan(0)
      }
    })
  })
})
