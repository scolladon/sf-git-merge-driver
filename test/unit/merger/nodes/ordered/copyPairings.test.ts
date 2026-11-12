import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  type KeyCopies,
  type Pairing,
  readings,
} from '../../../../../src/merger/nodes/keyedReadings.js'
import {
  type Draft,
  type KnownPoints,
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

  describe('given an alternative', () => {
    describe('when its drafts are read twice', () => {
      it('then the same array comes back', () => {
        // Arrange
        const [sut] = pairedCopiesOf(KEY, slotsOf(copiesOf([''], [''], [''])))
        const first = sut.drafts()

        // Act
        const second = sut.drafts()

        // Assert
        expect(second).toBe(first)
      })
    })
  })

  describe('given two alternatives pairing local alike', () => {
    const copies = copiesOf(['', ''], ['', ''], ['edited', 'apart'])

    describe('when their local points are asked with one memory', () => {
      it('then they share one array', () => {
        // Arrange
        const [first, sut] = pairedCopiesOf(KEY, slotsOf(copies))
        const known: KnownPoints = new Map()
        const expected = first.pointsOn('local', known)

        // Act
        const result = sut.pointsOn('local', known)

        // Assert
        expect(result).toBe(expected)
        expect(result).toEqual([
          { ancestor: 0, position: 0 },
          { ancestor: 1, position: 1 },
        ])
      })
    })

    describe('when their other points are asked with one memory', () => {
      it('then each holds its own array', () => {
        // Arrange
        const [first, sut] = pairedCopiesOf(KEY, slotsOf(copies))
        const known: KnownPoints = new Map()
        const firstPoints = first.pointsOn('other', known)

        // Act
        const result = sut.pointsOn('other', known)

        // Assert
        expect(firstPoints).toEqual([
          { ancestor: 0, position: 0 },
          { ancestor: 1, position: 1 },
        ])
        expect(result).toEqual([
          { ancestor: 0, position: 1 },
          { ancestor: 1, position: 0 },
        ])
      })
    })
  })

  describe.each([
    [
      'a value carried by an ancestor copy both sides pair',
      copiesOf([''], [''], ['']),
      { local: ['shared'], other: ['shared'] },
      ['shared'],
      false,
    ],
    [
      'a value other carries on an ancestor copy local does not pair',
      copiesOf(['', 'edited'], [''], ['', 'edited']),
      { local: ['first'], other: ['first', 'kept'] },
      ['kept'],
      true,
    ],
    [
      'a value local carries on an ancestor copy other does not pair',
      copiesOf(['', 'edited'], ['', 'edited'], ['']),
      { local: ['first', 'kept'], other: ['first'] },
      ['kept'],
      true,
    ],
    [
      'values carried by the pair of the copies both sides add',
      copiesOf([''], ['', 'edited'], ['', 'apart']),
      { local: ['first', 'added'], other: ['first', 'also'] },
      ['added', 'also'],
      false,
    ],
    [
      'a value local alone adds',
      copiesOf([''], ['', ''], ['']),
      { local: ['first', 'added'], other: ['first'] },
      ['added'],
      true,
    ],
  ])('given %s', (_title, copies, signatures, held, expected) => {
    describe('when asking whether the alternative loses it', () => {
      it(`then it answers ${expected}`, () => {
        // Arrange
        const [sut] = pairedCopiesOf(KEY, slotsOf(copies))

        // Act
        const result = sut.loses(new Set(held), signatures)

        // Assert
        expect(result).toBe(expected)
      })
    })
  })
})
