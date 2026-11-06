import fc from 'fast-check'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { KeyedArrayMergeNode } from '../../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { collapsibleKeys } from '../../../../../src/merger/nodes/ordered/collapsible.js'
import {
  type GroupedTies,
  identityTies,
} from '../../../../../src/merger/nodes/ordered/identity.js'
import { isTied } from '../../../../../src/merger/nodes/ordered/identityComponents.js'
import { mergeOrderedArrays } from '../../../../../src/merger/nodes/ordered/mergeOrdered.js'
import { mergeReading } from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import type { Reading } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import {
  type OrderedSides,
  wrapSides,
} from '../../../../../src/merger/nodes/ordered/orderedSides.js'
import { mergePartwise } from '../../../../../src/merger/nodes/ordered/partwise.js'
import { tiePartsOf } from '../../../../../src/merger/nodes/ordered/tieParts.js'
import { MetadataService } from '../../../../../src/service/MetadataService.js'
import type {
  JsonArray,
  JsonObject,
} from '../../../../../src/types/jsonTypes.js'
import { jsonIdentical } from '../../../../../src/utils/jsonEqual.js'
import { mergeOrderedArrays as referenceMerge } from '../../../../utils/oracles/perReadingMerge.js'
import { mergeOrderedArrays as streamMerge } from '../../../../utils/oracles/representativeMerge/mergeOrdered.js'
import { mergeOrderedArrays as tieScanMerge } from '../../../../utils/oracles/tieScanMerge.js'
import {
  type Case,
  caseArb,
  IDENTITY,
  IDENTITY_ANCESTORS,
  IDENTITY_TOKENS,
  SMALL,
  SMALL_ANCESTORS,
} from '../../../../utils/orderedCases.js'
import {
  cutCaseArb,
  groupCaseArb,
  LAYOUT_SHAPES,
  layoutSides,
  SHAPES,
  shapeSides,
} from '../../../../utils/orderedCuts.js'
import {
  ORDERED_ATTRIBUTE,
  orderedSides,
  toEntry,
} from '../../../../utils/orderedTokens.js'
import { defaultConfig } from '../../../../utils/testConfig.js'
import {
  contestedSidesArb,
  dupSidesArb,
  merge,
  ordered,
  render,
} from '../../laws/arbitraries.js'

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

const referenceSpy = vi.fn(referenceMerge)
const tieScanSpy = vi.fn(tieScanMerge)
const streamSpy = vi.fn(streamMerge)

const GRID_COPIES = [2, 3]
const GRID_GADGETS = [1, 2, 3, 4]
// The group path is reached by a tenth of the sampled cases: the property over
// those cases runs more times so the path sees tens of them per seed
const GROUP_RUNS = 400
// On the merge's own path 5-14 cases per 100 merge every representative clean
// and 1-5 hold several: sampling as many cases as the property runs keeps a
// margin above the thresholds
const REACH_RUNS = GROUP_RUNS
const MIN_CLEAN_GROUPS = 5
const MIN_SEVERAL_GROUPS = 1
// A cell merging 81 readings through the head and the reference under
// coverage takes seconds when the suite's workers compete for the machine
const GRID_CELL_TIMEOUT_MS = 30_000

describe('given generated token sides', () => {
  describe('when merged', () => {
    it.each([
      [
        'repeated keyed and keyless keys',
        caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
      ],
      ['few repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
    ])('then the result equals the per-reading merge of %s', (_name, cases) => {
      fc.assert(
        fc.property(cases, ([ancestor, local, other]) => {
          // Arrange
          const sides = orderedSides(
            ancestor.join(' '),
            local.join(' '),
            other.join(' ')
          )
          const expected = referenceMerge(
            sides,
            ORDERED_ATTRIBUTE,
            defaultConfig
          )

          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(expected)
        })
      )
    })
  })
})

describe('given generated token sides joined by unique keys', () => {
  describe('when merged', () => {
    it.each([
      [
        'repeated keyed and keyless keys',
        caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
      ],
      ['few repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
      [
        'parts joined by unique keys',
        cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
      ],
      [
        'parts of few repeated keys joined by unique keys',
        cutCaseArb(SMALL_ANCESTORS, SMALL),
      ],
    ])('then the result equals the tie-scan merge of %s', (_name, cases) => {
      fc.assert(
        fc.property(cases, ([ancestor, local, other]) => {
          // Arrange
          const sides = orderedSides(
            ancestor.join(' '),
            local.join(' '),
            other.join(' ')
          )
          const expected = tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(expected)
        })
      )
    })
  })
})

describe.each(
  SHAPES.flatMap(shape =>
    GRID_COPIES.flatMap(copies =>
      GRID_GADGETS.map(gadgets => [shape, copies, gadgets] as const)
    )
  )
)('given the %s grid at r = %i, m = %i', (shape, copies, gadgets) => {
  describe('when merged', () => {
    it(
      'then the result equals the tie-scan merge',
      () => {
        // Arrange
        const sides = shapeSides(shape, copies, gadgets)
        const expected = tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(expected)
      },
      GRID_CELL_TIMEOUT_MS
    )
  })
})

describe.each(
  LAYOUT_SHAPES.flatMap(layout =>
    GRID_COPIES.flatMap(copies =>
      GRID_GADGETS.map(gadgets => [layout, copies, gadgets] as const)
    )
  )
)('given the %s layout at r = %i, m = %i', (layout, copies, gadgets) => {
  describe('when merged', () => {
    it(
      'then the result equals the tie-scan merge',
      () => {
        // Arrange
        const sides = layoutSides(layout, copies, gadgets)
        const expected = tieScanMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(expected)
      },
      GRID_CELL_TIMEOUT_MS
    )
  })
})

const gridOf = <Name extends string>(names: readonly Name[]) =>
  names.flatMap(name =>
    GRID_COPIES.flatMap(copies =>
      GRID_GADGETS.map(gadgets => [name, copies, gadgets] as const)
    )
  )

describe('given generated token sides with interchangeable copies', () => {
  describe('when merged', () => {
    it.each([
      [
        'repeated keyed and keyless keys',
        caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
      ],
      ['few repeated keys', caseArb(SMALL_ANCESTORS, SMALL)],
      [
        'parts joined by unique keys',
        cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
      ],
      [
        'parts of few repeated keys joined by unique keys',
        cutCaseArb(SMALL_ANCESTORS, SMALL),
      ],
      ['spans of identical copies one side drops', groupCaseArb],
    ])(
      'then the result equals the merge before grouping of %s',
      (_name, cases) => {
        fc.assert(
          fc.property(cases, ([ancestor, local, other]) => {
            // Arrange
            const sides = orderedSides(
              ancestor.join(' '),
              local.join(' '),
              other.join(' ')
            )
            const expected = streamMerge(
              sides,
              ORDERED_ATTRIBUTE,
              defaultConfig
            )

            const sut = mergeOrderedArrays

            // Act
            const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

            // Assert
            expect(result).toStrictEqual(expected)
            expect(jsonIdentical(result.output, expected.output)).toBe(true)
          })
        )
      }
    )
  })
})

describe.each(gridOf(SHAPES))(
  'given the %s grid at r = %i, m = %i read against the merge before grouping',
  (shape, copies, gadgets) => {
    describe('when merged', () => {
      it('then the result equals the merge before grouping', () => {
        // Arrange
        const sides = shapeSides(shape, copies, gadgets)
        const expected = streamMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(jsonIdentical(result.output, expected.output)).toBe(true)
      })
    })
  }
)

describe.each(gridOf(LAYOUT_SHAPES))(
  'given the %s layout at r = %i, m = %i read against the merge before grouping',
  (layout, copies, gadgets) => {
    describe('when merged', () => {
      it('then the result equals the merge before grouping', () => {
        // Arrange
        const sides = layoutSides(layout, copies, gadgets)
        const expected = streamMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

        const sut = mergeOrderedArrays

        // Act
        const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(jsonIdentical(result.output, expected.output)).toBe(true)
      })
    })
  }
)

const takesASideWhole = (sides: OrderedSides): boolean =>
  jsonIdentical(sides.ancestor, sides.local) ||
  jsonIdentical(sides.ancestor, sides.other) ||
  jsonIdentical(sides.local, sides.other)

const mergesPartwise = (sides: OrderedSides, ties: GroupedTies): boolean => {
  const parts = tiePartsOf(sides, ties, ORDERED_ATTRIBUTE)
  if (parts.tied.length < 2) return false
  const merge = (reading: Reading) =>
    mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig)
  const wrapped = wrapSides(sides, ORDERED_ATTRIBUTE)
  return mergePartwise({ wrapped, ties, parts, merge }) !== null
}

// The representatives the merge itself walks: none on the exits before the
// group path (a side taken whole, no tied component, the merge part by part
// answering, no tied component holding an interchangeable key)
const representativesOf = (tokens: Case): readonly Reading[] => {
  const sides = orderedSides(
    tokens[0].join(' '),
    tokens[1].join(' '),
    tokens[2].join(' ')
  )
  if (takesASideWhole(sides)) return []
  const { ancestor, local, other, keys } = sides
  const ties = identityTies(ancestor, local, other, keys)
  const tied = ties.components.filter(isTied)
  if (tied.length === 0) return []
  if (tied.length >= 2 && mergesPartwise(sides, ties)) return []
  const collapsible = collapsibleKeys(sides)
  const holdsCollapsible = tied.some(component =>
    component.members.some(stretch => collapsible.has(ties.keyOf(stretch)))
  )
  return holdsCollapsible ? [...ties.representatives(collapsible)] : []
}

const mergesClean = (reading: Reading): boolean =>
  !mergeReading(reading, ORDERED_ATTRIBUTE, defaultConfig).hasConflict

describe('given sampled token sides with spans of identical copies', () => {
  const sampled = fc.sample(groupCaseArb, REACH_RUNS).map(representativesOf)

  describe('when their representatives are merged', () => {
    it('then enough cases merge every representative clean', () => {
      // Arrange
      const grouped = sampled.filter(reps => reps.length > 0)

      // Act
      const result = grouped.filter(reps => reps.every(mergesClean))

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(MIN_CLEAN_GROUPS)
    })

    it('then enough cases hold more than one representative', () => {
      // Act
      const result = sampled.filter(reps => reps.length > 1)

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(MIN_SEVERAL_GROUPS)
    })
  })
})

describe('given many generated token sides with spans of identical copies', () => {
  describe('when merged', () => {
    it('then the result equals the merge before grouping', () => {
      fc.assert(
        fc.property(groupCaseArb, ([ancestor, local, other]) => {
          // Arrange
          const sides = orderedSides(
            ancestor.join(' '),
            local.join(' '),
            other.join(' ')
          )
          const expected = streamMerge(sides, ORDERED_ATTRIBUTE, defaultConfig)

          const sut = mergeOrderedArrays

          // Act
          const result = sut(sides, ORDERED_ATTRIBUTE, defaultConfig)

          // Assert
          expect(result).toStrictEqual(expected)
        }),
        { numRuns: GROUP_RUNS }
      )
    })
  })
})

describe('given the per-reading merge wired in', () => {
  let reference: typeof import('../../laws/arbitraries.js')
  let ReferenceNode: typeof KeyedArrayMergeNode
  beforeAll(async () => {
    vi.resetModules()
    // A factory importing the reference never resolves: the reference waits on
    // the cycle through MergeNodeFactory that this very factory stands in for
    vi.doMock(
      '../../../../../src/merger/nodes/ordered/mergeOrdered.js',
      () => ({ mergeOrderedArrays: referenceSpy })
    )
    reference = await import('../../laws/arbitraries.js')
    ReferenceNode = (
      await import('../../../../../src/merger/nodes/KeyedArrayMergeNode.js')
    ).KeyedArrayMergeNode
    vi.doUnmock('../../../../../src/merger/nodes/ordered/mergeOrdered.js')
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
      expect(referenceSpy).toHaveBeenCalled()
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
      expect(referenceSpy).toHaveBeenCalled()
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
      expect(referenceSpy).toHaveBeenCalled()
    })
  })
})

describe('given the tie-scan merge wired in', () => {
  let reference: typeof import('../../laws/arbitraries.js')
  beforeAll(async () => {
    vi.resetModules()
    // A factory importing the reference never resolves: the reference waits on
    // the cycle through MergeNodeFactory that this very factory stands in for
    vi.doMock(
      '../../../../../src/merger/nodes/ordered/mergeOrdered.js',
      () => ({ mergeOrderedArrays: tieScanSpy })
    )
    reference = await import('../../laws/arbitraries.js')
    vi.doUnmock('../../../../../src/merger/nodes/ordered/mergeOrdered.js')
  })

  describe('when token sides joined by unique keys are merged', () => {
    it('then output, conflict and rendering are identical', async () => {
      await fc.assert(
        fc.asyncProperty(
          cutCaseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
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
      expect(tieScanSpy).toHaveBeenCalled()
    })
  })
})

describe('given the merge before grouping wired in', () => {
  let reference: typeof import('../../laws/arbitraries.js')
  beforeAll(async () => {
    vi.resetModules()
    // A factory importing the reference never resolves: the reference waits on
    // the cycle through MergeNodeFactory that this very factory stands in for
    vi.doMock(
      '../../../../../src/merger/nodes/ordered/mergeOrdered.js',
      () => ({ mergeOrderedArrays: streamSpy })
    )
    reference = await import('../../laws/arbitraries.js')
    vi.doUnmock('../../../../../src/merger/nodes/ordered/mergeOrdered.js')
  })

  describe.each([
    [
      'token sides with keyed and keyless repeated keys',
      caseArb(IDENTITY_ANCESTORS, IDENTITY, IDENTITY_TOKENS),
    ],
    ['token sides with spans of identical copies', groupCaseArb],
  ])('when %s are merged', (_name, cases) => {
    it('then output, conflict and rendering are identical', async () => {
      await fc.assert(
        fc.asyncProperty(cases, async tokens => {
          // Arrange
          const [ancestor, local, other] = tokens.map(side => side.map(toEntry))
          const expected = reference.merge(ordered, ancestor, local, other)

          // Act
          const sut = merge(ordered, ancestor, local, other)

          // Assert
          expect(sut.hasConflict).toBe(expected.hasConflict)
          expect(sut.output).toEqual(expected.output)
          expect(await render(sut.output)).toBe(
            await reference.render(expected.output)
          )
        })
      )
      expect(streamSpy).toHaveBeenCalled()
    })
  })

  describe.each([
    ['entries with duplicated keys', dupSidesArb(ordered)],
    ['entries with one contested entry', contestedSidesArb(ordered)],
  ])('when %s are merged', (_name, cases) => {
    it('then output, conflict and rendering are identical', async () => {
      await fc.assert(
        fc.asyncProperty(cases, async ([ancestor, local, other]) => {
          // Arrange
          const expected = reference.merge(ordered, ancestor, local, other)

          // Act
          const sut = merge(ordered, ancestor, local, other)

          // Assert
          expect(sut.hasConflict).toBe(expected.hasConflict)
          expect(sut.output).toEqual(expected.output)
          expect(await render(sut.output)).toBe(
            await reference.render(expected.output)
          )
        })
      )
      expect(streamSpy).toHaveBeenCalled()
    })
  })
})
