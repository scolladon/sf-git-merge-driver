import { describe, expect, it } from 'vitest'
import { listFixtures } from '../../../utils/goldenFile.js'

describe('golden-file fixture harness', () => {
  const fixtures = listFixtures()

  describe('given the fixtures directory', () => {
    it('when loading then at least one fixture is discovered', () => {
      expect(fixtures.length).toBeGreaterThan(0)
    })
  })

  for (const fixture of fixtures) {
    describe(`given fixture ${fixture.id}`, () => {
      it('when loaded then parity.json is valid', () => {
        if (fixture.parity.mode === 'divergence') {
          expect(fixture.parity.against).toBeTypeOf('string')
          expect(fixture.parity.adr).toBeTypeOf('string')
        } else {
          expect(fixture.parity.mode).toBe('parity')
        }
      })

      it('when loaded then expected.xml is non-empty XML', () => {
        expect(fixture.expectedCurrent.length).toBeGreaterThan(0)
        expect(fixture.expectedCurrent).toMatch(/^<\?xml/)
      })

      it('when loaded then either merge inputs or ordered-input are present', () => {
        const hasMergeInputs =
          fixture.inputs.ancestor !== undefined &&
          fixture.inputs.ours !== undefined &&
          fixture.inputs.theirs !== undefined
        const hasOrderedInput = fixture.inputs.ordered !== undefined
        expect(hasMergeInputs || hasOrderedInput).toBe(true)
      })

      if (fixture.parity.mode === 'divergence') {
        it('when divergence-mode then expected-new.xml is present', () => {
          expect(fixture.expectedNew).toBeDefined()
          expect(fixture.expectedNew!.length).toBeGreaterThan(0)
        })
      }
    })
  }
})
