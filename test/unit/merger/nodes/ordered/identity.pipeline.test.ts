import fc from 'fast-check'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { KeyedArrayMergeNode } from '../../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { MetadataService } from '../../../../../src/service/MetadataService.js'
import type {
  JsonArray,
  JsonObject,
} from '../../../../../src/types/jsonTypes.js'
import {
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
} from '../../../../utils/orderedCases.js'
import { toEntry } from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'
import { merge, ordered, render } from '../../laws/arbitraries.js'

const fieldPermissionsKey =
  MetadataService.getKeyFieldExtractor('fieldPermissions')

const MAX_SIDE_LENGTH = 5

// Two equal pairs: identical copies recur in the generated sides
const EQUAL_PAIRS: readonly JsonObject[] = [
  { name: 'a' },
  { name: 'a' },
  { name: 'b' },
  { name: 'b' },
]

const entry1 = { editable: 'false', readable: 'false' }
const entry2 = { editable: 'false', readable: 'true' }
const edited1 = { editable: 'true', readable: 'false' }

// Keyless entries (no field), keyed ones, and a key spelled like the
// signature of a keyless entry
const PERMISSIONS: readonly JsonObject[] = [
  entry1,
  entry2,
  edited1,
  { field: 'A', editable: 'false' },
  { field: 'A', editable: 'true' },
  { field: JSON.stringify(entry1), editable: 'true' },
]

const sideOf = (pool: readonly JsonObject[]): fc.Arbitrary<JsonArray> =>
  fc.array(fc.constantFrom(...pool), { maxLength: MAX_SIDE_LENGTH })

const sidesOf = (
  pool: readonly JsonObject[]
): fc.Arbitrary<readonly [JsonArray, JsonArray, JsonArray]> =>
  fc.tuple(sideOf(pool), sideOf(pool), sideOf(pool))

describe('given the enumerating identity wired in', () => {
  let reference: typeof import('../../laws/arbitraries.js')
  let ReferenceNode: typeof KeyedArrayMergeNode
  beforeAll(async () => {
    vi.resetModules()
    vi.doMock(
      '../../../../../src/merger/nodes/ordered/identity.js',
      async () => {
        const oracle = await import(
          '../../../../utils/oracles/enumeratedIdentity.js'
        )
        // The merge only reads the stream of readings from the tie set.
        return {
          identityTies: (...sides: Parameters<typeof oracle.identify>) => ({
            readings: () => oracle.identify(...sides),
          }),
        }
      }
    )
    reference = await import('../../laws/arbitraries.js')
    ReferenceNode = (
      await import('../../../../../src/merger/nodes/KeyedArrayMergeNode.js')
    ).KeyedArrayMergeNode
    vi.doUnmock('../../../../../src/merger/nodes/ordered/identity.js')
  })

  describe('when token sides with keyed and keyless repeated keys are merged', () => {
    it('then output, conflict and rendering are identical', async () => {
      await fc.assert(
        fc.asyncProperty(
          caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
          async tokens => {
            // Arrange
            const [ancestor, local, other] = tokens.map(side =>
              side.map(toEntry)
            )
            const expected = reference.merge(ordered, ancestor, local, other)

            // Act
            const sut = merge(ordered, ancestor, local, other)

            // Assert
            expect(sut.hasConflict).toBe(expected.hasConflict)
            expect(sut.output).toEqual(expected.output)
            expect(await render(sut.output)).toBe(
              await reference.render(expected.output)
            )
          }
        )
      )
    })
  })

  describe('when an array without a key extractor is merged', () => {
    it('then output and conflict are identical', () => {
      fc.assert(
        fc.property(sidesOf(EQUAL_PAIRS), ([ancestor, local, other]) => {
          // Arrange
          const build = (Node: typeof KeyedArrayMergeNode) =>
            new Node(
              ancestor,
              local,
              other,
              'unknownAttribute',
              undefined,
              true
            ).merge(defaultConfig)
          const expected = build(ReferenceNode)

          // Act
          const sut = build(KeyedArrayMergeNode)

          // Assert
          expect(sut.output).toEqual(expected.output)
          expect(sut.hasConflict).toBe(expected.hasConflict)
        })
      )
    })
  })

  describe('when keyed entries among keyless ones and a key spelled like a keyless signature are merged', () => {
    it('then output and conflict are identical', () => {
      fc.assert(
        fc.property(sidesOf(PERMISSIONS), ([ancestor, local, other]) => {
          // Arrange
          const build = (Node: typeof KeyedArrayMergeNode) =>
            new Node(
              ancestor,
              local,
              other,
              'fieldPermissions',
              fieldPermissionsKey,
              true
            ).merge(defaultConfig)
          const expected = build(ReferenceNode)

          // Act
          const sut = build(KeyedArrayMergeNode)

          // Assert
          expect(sut.output).toEqual(expected.output)
          expect(sut.hasConflict).toBe(expected.hasConflict)
        })
      )
    })
  })
})
