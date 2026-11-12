import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  type KeyCopies,
  type Pairing,
  readings,
} from '../../../../../src/merger/nodes/keyedReadings.js'
import {
  type Draft,
  type PairedCopies,
  pairedCopiesOf,
  type Slot,
  type Slots,
} from '../../../../../src/merger/nodes/ordered/copyPairings.js'
import type { JsonObject } from '../../../../../src/types/jsonTypes.js'

const KEY = 'a'

const entry = (extra: string): JsonObject => ({ name: KEY, extra })

const slotsOf = (copies: KeyCopies): Slots => {
  const placed = (side: readonly JsonObject[]): Slot[] =>
    side.map((value, pos) => ({ pos, value }))
  return {
    ancestor: placed(copies.ancestor),
    local: placed(copies.local),
    other: placed(copies.other),
  }
}

const asPairing = (draft: Draft): Pairing => ({
  ...(draft.ancestor && { ancestor: draft.ancestor.value }),
  ...(draft.local && { local: draft.local.value }),
  ...(draft.other && { other: draft.other.value }),
})

const pairingsOf = (paired: PairedCopies): readonly Pairing[] =>
  paired.drafts().map(asPairing)

const NONE = '-'

const placeOf = (slot: Slot | undefined): string =>
  slot === undefined ? NONE : String(slot.pos)

// ancestor,local,other positions of every draft of an alternative
const shapeOf = (paired: PairedCopies): string =>
  paired
    .drafts()
    .map(draft =>
      [draft.ancestor, draft.local, draft.other].map(placeOf).join(',')
    )
    .join(' ')

const copiesOf = (
  ancestor: readonly string[],
  local: readonly string[],
  other: readonly string[]
): KeyCopies => ({
  ancestor: ancestor.map(entry),
  local: local.map(entry),
  other: other.map(entry),
})

describe('pairedCopiesOf', () => {
  describe('given generated copies of one key', () => {
    const MAX_COPIES = 3
    const sideArb = fc.array(fc.constantFrom('', 'edited', 'apart'), {
      maxLength: MAX_COPIES,
    })
    const copiesArb: fc.Arbitrary<KeyCopies> = fc
      .record({ ancestor: sideArb, local: sideArb, other: sideArb })
      .map(({ ancestor, local, other }) => copiesOf(ancestor, local, other))

    describe('when pairing them', () => {
      it("then the alternatives' drafts are the readings of the copies, in order", () => {
        fc.assert(
          fc.property(copiesArb, copies => {
            // Arrange
            const expected = [...readings(copies)]

            // Act
            const sut = pairedCopiesOf(KEY, slotsOf(copies))

            // Assert
            expect(sut.map(pairingsOf)).toEqual(expected)
          })
        )
      })
    })
  })

  describe.each([
    [
      'both sides keep the ancestor copy and add one of their own',
      copiesOf([''], ['', 'edited'], ['', 'apart']),
      ['0,0,0 -,1,1'],
    ],
    [
      'local alone adds a copy',
      copiesOf([''], ['', ''], ['']),
      ['0,0,0 -,1,-'],
    ],
    [
      'every side keeps both copies',
      copiesOf(['', ''], ['', ''], ['', '']),
      ['0,0,0 1,1,1'],
    ],
    [
      'local drops an ancestor copy the other side keeps',
      copiesOf(['', 'edited'], [''], ['', 'edited']),
      ['0,0,0 1,-,1'],
    ],
    [
      'other alone adds a copy',
      copiesOf([''], [''], ['', '']),
      ['0,0,0 -,-,1'],
    ],
  ])('given %s', (_title, copies, expected) => {
    describe('when pairing them', () => {
      it('then the alternatives pair the copies as the readings do', () => {
        // Arrange
        const slots = slotsOf(copies)

        // Act
        const sut = pairedCopiesOf(KEY, slots)

        // Assert
        expect(sut.map(shapeOf)).toEqual(expected)
        expect(sut.map(pairingsOf)).toEqual([...readings(copies)])
      })
    })
  })
})
