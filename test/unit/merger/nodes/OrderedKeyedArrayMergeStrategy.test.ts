import { describe, expect, it } from 'vitest'
import type { KeyedSides } from '../../../../src/merger/nodes/KeyedArrayIndex.js'
import { OrderedKeyedArrayMergeStrategy } from '../../../../src/merger/nodes/OrderedKeyedArrayMergeStrategy.js'
import { isConflictBlock } from '../../../../src/types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const keyExtractor = (item: JsonObject): string => item['fullName'] as string

const keysOf = (side: JsonArray): string[] =>
  side.map(item => keyExtractor(item as JsonObject))

const toKeyedSides = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray
): KeyedSides => ({
  ancestor: keysOf(ancestor),
  local: keysOf(local),
  other: keysOf(other),
})

const getLabel = (obj: JsonObject): string | undefined => {
  const label = obj['label'] ?? obj['fullName']
  return typeof label === 'string' ? label : undefined
}

const extractLabels = (items: JsonArray): string[] =>
  items.flatMap((item): string[] => {
    if (!item) return []
    if (Array.isArray(item)) return extractLabels(item)

    const obj = item as JsonObject

    const wrapped = obj['customValue'] as JsonObject | undefined
    const content = wrapped ?? obj

    const label = getLabel(content)
    return label ? [label] : []
  })

interface ConflictDescription {
  local: string[]
  ancestor: string[]
  other: string[]
}

const extractConflictStructure = (
  items: JsonArray
): (string | ConflictDescription)[] =>
  items.flatMap((item): (string | ConflictDescription)[] => {
    if (!item) return []

    const obj = item as JsonObject

    if (isConflictBlock(obj)) {
      return [
        {
          local: extractLabels(obj.local as JsonArray),
          ancestor: extractLabels(obj.ancestor as JsonArray),
          other: extractLabels(obj.other as JsonArray),
        },
      ]
    }

    const wrapped = obj['customValue'] as JsonObject | undefined
    const content = wrapped ?? obj
    const label = getLabel(content)
    return label ? [label] : []
  })

const createStrategy = (
  ancestor: JsonArray,
  local: JsonArray,
  other: JsonArray
) =>
  new OrderedKeyedArrayMergeStrategy(
    ancestor,
    local,
    other,
    'customValue',
    toKeyedSides(ancestor, local, other)
  )

// Helper: 'A' -> { fullName: 'A', label: 'A' }, 'A:A_MOD' -> { fullName: 'A', label: 'A_MOD' }
const el = (s: string) => {
  const [name, label] = s.split(':')
  return { fullName: name, label: label ?? name }
}
const toElements = (arr: string[]) => arr.map(el)

describe('OrderedKeyedArrayMergeStrategy', () => {
  type GracefulMergeScenario = [
    name: string,
    ancestor: string[],
    local: string[],
    other: string[],
    expectedOutput: string[],
  ]

  const gracefulMergeScenarios: GracefulMergeScenario[] = [
    [
      'M1: Disjoint Changes',
      ['A', 'B', 'C'],
      ['A:A_MOD', 'B', 'C'],
      ['A', 'B', 'C:C_MOD'],
      ['A_MOD', 'B', 'C_MOD'],
    ],
    ['M2: Identical Changes', ['A'], ['A:A_MOD'], ['A:A_MOD'], ['A_MOD']],
    ['M3: One-Sided Change', ['A'], ['A'], ['A:A_MOD'], ['A_MOD']],
    [
      'M4: One-Sided Addition (Local)',
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'B', 'C'],
    ],
    [
      'M5: One-Sided Addition (Other)',
      ['A', 'C'],
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'B', 'C'],
    ],
    [
      'M6: Identical Addition (Both)',
      ['A'],
      ['A', 'B'],
      ['A', 'B'],
      ['A', 'B'],
    ],
    [
      'M7: One-Sided Deletion (Local)',
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C'],
    ],
    [
      'M8: One-Sided Deletion (Other)',
      ['A', 'B', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'C'],
    ],
    [
      'M9: Identical Deletion',
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'C'],
      ['A', 'C'],
    ],
    [
      'M10: Swap Elements',
      ['A', 'B', 'C', 'D'],
      ['B', 'A', 'C', 'D'],
      ['A', 'B', 'D', 'C'],
      ['B', 'A', 'D', 'C'],
    ],
    [
      'M11: Partial Moves with Addition',
      ['A', 'B', 'C'],
      ['B', 'A', 'C', 'D'],
      ['A', 'B', 'C'],
      ['B', 'A', 'C', 'D'],
    ],
    [
      'M12: Moves with Deletion',
      ['A', 'B', 'C'],
      ['C', 'A'],
      ['A', 'B', 'C'],
      ['C', 'A'],
    ],
  ]

  describe('Graceful Merges', () => {
    it.each(gracefulMergeScenarios)(
      '%s',
      (_name, ancestor, local, other, expectedOutput) => {
        // Arrange
        const strategy = createStrategy(
          toElements(ancestor),
          toElements(local),
          toElements(other)
        )

        // Act
        const result = strategy.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(expectedOutput)
      }
    )
  })

  const conflict = (
    local: string[],
    ancestor: string[],
    other: string[]
  ): ConflictDescription => ({ local, ancestor, other })

  type ConflictScenario = [
    name: string,
    ancestor: string[],
    local: string[],
    other: string[],
    expectedOutput: (string | ConflictDescription)[],
  ]

  const conflictScenarios: ConflictScenario[] = [
    [
      'C1: Concurrent Modification',
      ['A'],
      ['A:A_LOCAL'],
      ['A:A_OTHER'],
      [conflict(['A_LOCAL'], ['A'], ['A_OTHER'])],
    ],
    [
      'C2: Concurrent Insertion',
      ['A'],
      ['A', 'B'],
      ['A', 'C'],
      ['A', conflict(['B'], [], ['C'])],
    ],
    [
      'C3: Delete vs Modify',
      ['A'],
      [],
      ['A:A_MOD'],
      [conflict([], ['A'], ['A_MOD'])],
    ],
    [
      'C4: Divergent Moves',
      ['A', 'B', 'C'],
      ['B', 'A', 'C'],
      ['A', 'C', 'B'],
      [conflict(['B', 'A', 'C'], ['A', 'B', 'C'], ['A', 'C', 'B'])],
    ],
    [
      'C5: Partially Overlapping Hunks',
      ['A', 'B', 'C', 'D'],
      ['A', 'D'],
      ['A', 'B', 'D'],
      ['A', conflict([], ['B', 'C'], ['B']), 'D'],
    ],
    [
      'C6: Concurrent Addition at Different Positions',
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C', 'B'],
      [conflict(['A', 'B', 'C'], ['A', 'C'], ['A', 'C', 'B'])],
    ],
    [
      'C7: Concurrent Addition with Diverged Orderings',
      ['A', 'B'],
      ['B', 'A', 'X'],
      ['A', 'B', 'Y'],
      [conflict(['B', 'A', 'X'], ['A', 'B'], ['A', 'B', 'Y'])],
    ],
    [
      'C8: Delete vs Modify (Other Deletes)',
      ['A', 'B'],
      ['A', 'B:B_MOD'],
      ['A'],
      ['A', conflict(['B_MOD'], ['B'], [])],
    ],
    [
      'C9: Concurrent Addition of Same Key with Different Values',
      ['A'],
      ['A', 'B:B_LOCAL'],
      ['A', 'B:B_OTHER'],
      ['A', conflict(['B_LOCAL'], [], ['B_OTHER'])],
    ],
    [
      'C10: Divergent deletions in same gap (local deletes B, other deletes C)',
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'D'],
      ['A', 'B', 'D'],
      ['A', conflict(['C'], ['B', 'C'], ['B']), 'D'],
    ],
    // Gap-scoped addition conflict — exercises `detectGapConflict`
    // (the branch whose redundant `!setsEqual(...)` clause was removed).
    // Both sides share the ancestor spine [A, B] without any moves, and
    // each adds a different disjoint key in the trailing gap. The spine
    // stays intact and only the gap is marked as a conflict. Contrast
    // with C7 above, where ordering divergence triggers a full-array
    // conflict; this case is deliberately narrower.
    [
      'Gap conflict: disjoint additions in the trailing gap, no moves',
      ['A', 'B'],
      ['A', 'B', 'X'],
      ['A', 'B', 'Y'],
      ['A', 'B', conflict(['X'], [], ['Y'])],
    ],
    [
      'Both sides move an entry next to different additions',
      ['K', 'B'],
      ['B', 'X', 'K'],
      ['B', 'Y', 'K'],
      ['B', conflict(['X', 'K'], [], ['Y', 'K'])],
    ],
    [
      'Local deletes an entry other moves to another gap and edits',
      ['K', 'B', 'C'],
      ['B', 'C'],
      ['B', 'C', 'K:K_MOD'],
      ['B', 'C', conflict([], ['K'], ['K_MOD'])],
    ],
    [
      'Other deletes an entry local moves to another gap and edits',
      ['K', 'B', 'C'],
      ['B', 'C', 'K:K_MOD'],
      ['B', 'C'],
      ['B', 'C', conflict(['K_MOD'], ['K'], [])],
    ],
  ]

  // Additional scenarios to exercise gap analysis and spine processing branches
  const additionalGracefulScenarios: GracefulMergeScenario[] = [
    [
      'Local reorders and adds; other adds the same entry and one more',
      ['A', 'B'],
      ['B', 'A', 'X'],
      ['A', 'B', 'X', 'Y'],
      ['B', 'A', 'X', 'Y'],
    ],
    [
      'Other reorders and adds; local adds the same entry and one more',
      ['A', 'B'],
      ['A', 'B', 'X', 'Y'],
      ['B', 'A', 'X'],
      ['B', 'A', 'X', 'Y'],
    ],
    [
      'Only the other side reorders and adds',
      ['A', 'B'],
      ['A', 'B'],
      ['X', 'B', 'A'],
      ['X', 'B', 'A'],
    ],
    [
      'Only the local side reorders and adds',
      ['A', 'B'],
      ['X', 'B', 'A'],
      ['A', 'B'],
      ['X', 'B', 'A'],
    ],
    [
      'M13: Other-only move (local unchanged)',
      ['A', 'B', 'C'],
      ['A', 'B', 'C'],
      ['C', 'A', 'B'],
      ['C', 'A', 'B'],
    ],
    [
      'M14: Deletion from ancestor with modification of remaining',
      ['A', 'B', 'C'],
      ['A:A_MOD', 'C'],
      ['A', 'B', 'C'],
      ['A_MOD', 'C'],
    ],
    [
      'M15: Both delete same element (identical deletion in gap)',
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'C'],
      ['A', 'C'],
    ],
    [
      'M16: Multiple unchanged spine elements (adjacent anchors, empty gaps)',
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
    ],
    [
      'M17: Addition between spine elements (non-empty gap)',
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C'],
      ['A', 'B', 'C'],
    ],
    [
      'M18: One-sided move with same-side addition',
      ['A', 'B', 'C'],
      ['C', 'A', 'B', 'D'],
      ['A', 'B', 'C'],
      ['C', 'A', 'B', 'D'],
    ],
    [
      'M19: Delete and add in same gap',
      ['A', 'B', 'C'],
      ['A', 'D', 'C'],
      ['A', 'B', 'C'],
      ['A', 'D', 'C'],
    ],
    [
      'M20: Other-only addition with other-only move',
      ['A', 'B'],
      ['A', 'B'],
      ['B', 'A', 'X'],
      ['B', 'A', 'X'],
    ],
    [
      'M21: Local-only move with other-only addition',
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'B', 'X'],
      ['B', 'A', 'X'],
    ],
    [
      'M22: Gap with local deletion and other unchanged',
      ['A', 'B', 'C', 'D'],
      ['A', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'D'],
    ],
    [
      'M23: Gap with other addition and local unchanged',
      ['A', 'D'],
      ['A', 'D'],
      ['A', 'B', 'D'],
      ['A', 'B', 'D'],
    ],
    [
      'M24: Element unchanged in all three inside spine',
      ['A', 'B', 'C'],
      ['A', 'B:B_MOD', 'C'],
      ['A', 'B', 'C'],
      ['A', 'B_MOD', 'C'],
    ],
    [
      'M25: Multiple gaps between spine anchors',
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'X', 'C', 'D', 'E'],
      ['A', 'B', 'C', 'Y', 'E'],
      ['A', 'X', 'C', 'Y', 'E'],
    ],
    [
      'M26: Local-only move reordering 3 elements',
      ['A', 'B', 'C', 'D'],
      ['C', 'B', 'A', 'D'],
      ['A', 'B', 'C', 'D'],
      ['C', 'B', 'A', 'D'],
    ],
    [
      'M27: Gap with local add and ancestor delete (other unchanged)',
      ['A', 'B', 'C'],
      ['A', 'D', 'C'],
      ['A', 'B', 'C'],
      ['A', 'D', 'C'],
    ],
    [
      'M28: Move last element to first (boundary of getMovedElements loop)',
      ['A', 'B', 'C'],
      ['C', 'A', 'B'],
      ['A', 'B', 'C'],
      ['C', 'A', 'B'],
    ],
    [
      'M29: Local-only move with local-only addition (no other additions)',
      ['A', 'B'],
      ['B', 'A', 'X'],
      ['A', 'B'],
      ['B', 'A', 'X'],
    ],
    [
      'M30: Other adds element already in local (dedup branch)',
      ['A'],
      ['A', 'B'],
      ['A', 'B'],
      ['A', 'B'],
    ],
    [
      'Both sides apply the same reorder of an entry kept on all sides',
      ['C', 'B'],
      ['B', 'C'],
      ['B', 'C'],
      ['B', 'C'],
    ],
    [
      'Local reorders while other edits an entry and deletes another',
      ['C', 'D'],
      ['D', 'C'],
      ['C:C_MOD'],
      ['C_MOD'],
    ],
    [
      'Other reorders while local edits an entry and deletes another',
      ['C', 'D'],
      ['C:C_MOD'],
      ['D', 'C'],
      ['C_MOD'],
    ],
    [
      'Local reorders and adds two entries other adds in the reverse order',
      ['A', 'B'],
      ['B', 'A', 'X', 'Y'],
      ['A', 'B', 'Y', 'X'],
      ['B', 'A', 'X', 'Y'],
    ],
    [
      'Other reorders and adds two entries local adds in the reverse order',
      ['A', 'B'],
      ['A', 'B', 'Y', 'X'],
      ['B', 'A', 'X', 'Y'],
      ['B', 'A', 'X', 'Y'],
    ],
    [
      'Other inserts before the entry both sides add after a shared anchor',
      ['P'],
      ['P', 'D'],
      ['P', 'B', 'D'],
      ['P', 'B', 'D'],
    ],
    [
      'Local inserts before the entry both sides add after a shared anchor',
      ['P'],
      ['P', 'B', 'D'],
      ['P', 'D'],
      ['P', 'B', 'D'],
    ],
    [
      'Local deletes an entry other only moves, and adds another',
      ['K', 'B', 'C'],
      ['B', 'C', 'Z'],
      ['B', 'C', 'K'],
      ['B', 'C', 'Z'],
    ],
    [
      'Other deletes an entry local only moves, and adds another',
      ['K', 'B', 'C'],
      ['B', 'C', 'K'],
      ['B', 'C', 'Z'],
      ['B', 'C', 'Z'],
    ],
  ]

  describe('Additional Graceful Merges', () => {
    it.each(additionalGracefulScenarios)(
      '%s',
      (_name, ancestor, local, other, expectedOutput) => {
        // Arrange
        const strategy = createStrategy(
          toElements(ancestor),
          toElements(local),
          toElements(other)
        )

        // Act
        const result = strategy.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(expectedOutput)
      }
    )
  })

  describe('Conflicts', () => {
    it.each(conflictScenarios)(
      '%s',
      (_name, ancestor, local, other, expectedOutput) => {
        // Arrange
        const strategy = createStrategy(
          toElements(ancestor),
          toElements(local),
          toElements(other)
        )

        // Act
        const result = strategy.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractConflictStructure(result.output)).toEqual(expectedOutput)
      }
    )
  })

  describe('processKeyOrder with deleted elements', () => {
    it('given diverged ordering with one side deleting an element then filters out empty results', () => {
      // Arrange - local swaps A and B and deletes D; other edits C, so the
      // diverged path runs and D merges to nothing
      const strategy = createStrategy(
        toElements(['A', 'B', 'C', 'D']),
        toElements(['B', 'A', 'C']),
        toElements(['A', 'B', 'C:C_MOD', 'D'])
      )

      // Act
      const result = strategy.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(extractLabels(result.output)).toEqual(['B', 'A', 'C_MOD'])
    })
  })

  describe('given a side that repeats a key', () => {
    it('when a repeated key anchors the shared order then each occurrence is written once', () => {
      // Arrange
      const sut = createStrategy(
        toElements(['A', 'B', 'A']),
        toElements(['A', 'B', 'A', 'X']),
        toElements(['A', 'B:B_MOD', 'A'])
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(extractLabels(result.output)).toEqual(['A', 'B_MOD', 'A', 'X'])
    })

    it('when only other changed then every repeated entry is kept', () => {
      // Arrange
      const sut = createStrategy(
        toElements(['A', 'B']),
        toElements(['A', 'B']),
        toElements(['A:A_FIRST', 'A:A_SECOND', 'B'])
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(extractLabels(result.output)).toEqual(['A_FIRST', 'A_SECOND', 'B'])
    })

    it('when only local changed then every repeated entry is kept', () => {
      // Arrange
      const sut = createStrategy(
        toElements(['A', 'B']),
        toElements(['A:A_FIRST', 'A:A_SECOND', 'B']),
        toElements(['A', 'B'])
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(extractLabels(result.output)).toEqual(['A_FIRST', 'A_SECOND', 'B'])
    })

    it('when orderings diverge then the conflict shows every repeated entry', () => {
      // Arrange
      const sut = createStrategy(
        toElements(['A', 'B', 'C']),
        toElements(['B', 'A', 'C']),
        toElements(['A:A_FIRST', 'A:A_SECOND', 'C', 'B'])
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(extractConflictStructure(result.output)).toEqual([
        conflict(
          ['B', 'A', 'C'],
          ['A', 'B', 'C'],
          ['A_FIRST', 'A_SECOND', 'C', 'B']
        ),
      ])
    })
  })

  describe('computeGapSets filtering', () => {
    it('given gap where ancestor has keys not in local or other then computes correct deleted sets', () => {
      // Arrange - A,B,C in ancestor; local has only A; other has only A
      // Both deleted B and C independently via gap processing
      const strategy = createStrategy(
        toElements(['X', 'A', 'B', 'C', 'Y']),
        toElements(['X', 'A', 'Y']),
        toElements(['X', 'A', 'Y'])
      )

      // Act
      const result = strategy.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(extractLabels(result.output)).toEqual(['X', 'A', 'Y'])
    })
  })
})
