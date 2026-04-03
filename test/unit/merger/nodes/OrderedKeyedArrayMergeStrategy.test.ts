import { describe, expect, it } from 'vitest'
import {
  ANCESTOR_CONFLICT_MARKER,
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { OrderedKeyedArrayMergeStrategy } from '../../../../src/merger/nodes/OrderedKeyedArrayMergeStrategy.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const CONFLICT_MARKERS = [
  `${LOCAL_CONFLICT_MARKER.repeat(DEFAULT_CONFLICT_MARKER_SIZE)} ${DEFAULT_LOCAL_CONFLICT_TAG}`,
  `${ANCESTOR_CONFLICT_MARKER.repeat(DEFAULT_CONFLICT_MARKER_SIZE)} ${DEFAULT_ANCESTOR_CONFLICT_TAG}`,
  `${SEPARATOR.repeat(DEFAULT_CONFLICT_MARKER_SIZE)}`,
  `${OTHER_CONFLICT_MARKER.repeat(DEFAULT_CONFLICT_MARKER_SIZE)} ${DEFAULT_OTHER_CONFLICT_TAG}`,
]

const keyExtractor = (item: JsonObject): string => item['fullName'] as string

const getTextContent = (obj: JsonObject, key: string): string | undefined => {
  const val = obj[key]
  if (!val) return undefined
  if (Array.isArray(val)) {
    const first = val[0] as JsonObject
    return (first?.[TEXT_TAG] as string) ?? String(first)
  }
  return val as string
}

const extractLabels = (items: JsonArray): string[] =>
  items.flatMap((item): string[] => {
    if (!item) return []
    if (Array.isArray(item)) return extractLabels(item)

    const obj = item as JsonObject

    // Conflict marker
    const text = (obj[TEXT_TAG] as string)?.trim()
    if (text && CONFLICT_MARKERS.some(m => text.startsWith(m.split(' ')[0]))) {
      return [text]
    }

    // Unwrap customValue if present
    const wrapped = obj['customValue']
    let content: JsonObject
    if (wrapped && Array.isArray(wrapped)) {
      content = Object.assign({}, ...(wrapped as JsonObject[]))
    } else if (wrapped) {
      content = wrapped as JsonObject
    } else {
      content = obj
    }

    const label =
      getTextContent(content, 'label') ?? getTextContent(content, 'fullName')
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
    keyExtractor
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
    it.each(
      gracefulMergeScenarios
    )('%s', (_name, ancestor, local, other, expectedOutput) => {
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
    })
  })

  type ConflictScenario = [
    name: string,
    ancestor: string[],
    local: string[],
    other: string[],
    expectedOutput: (string | ReturnType<typeof expect.stringContaining>)[],
  ]

  const L = expect.stringContaining(LOCAL_CONFLICT_MARKER)
  const A = expect.stringContaining(ANCESTOR_CONFLICT_MARKER)
  const S = expect.stringContaining(SEPARATOR)
  const O = expect.stringContaining(OTHER_CONFLICT_MARKER)

  const conflictScenarios: ConflictScenario[] = [
    [
      'C1: Concurrent Modification',
      ['A'],
      ['A:A_LOCAL'],
      ['A:A_OTHER'],
      [L, 'A_LOCAL', A, 'A', S, 'A_OTHER', O],
    ],
    [
      'C2: Concurrent Insertion',
      ['A'],
      ['A', 'B'],
      ['A', 'C'],
      ['A', L, 'B', A, S, 'C', O],
    ],
    [
      'C3: Delete vs Modify',
      ['A'],
      [],
      ['A:A_MOD'],
      [L, A, 'A', S, 'A_MOD', O],
    ],
    [
      'C4: Divergent Moves',
      ['A', 'B', 'C'],
      ['B', 'A', 'C'],
      ['A', 'C', 'B'],
      [L, 'B', 'A', 'C', A, 'A', 'B', 'C', S, 'A', 'C', 'B', O],
    ],
    [
      'C5: Partially Overlapping Hunks',
      ['A', 'B', 'C', 'D'],
      ['A', 'D'],
      ['A', 'B', 'D'],
      ['A', L, A, 'B', 'C', S, 'B', O, 'D'],
    ],
    [
      'C6: Concurrent Addition at Different Positions',
      ['A', 'C'],
      ['A', 'B', 'C'],
      ['A', 'C', 'B'],
      [L, 'A', 'B', 'C', A, 'A', 'C', S, 'A', 'C', 'B', O],
    ],
    [
      'C7: Concurrent Addition with Diverged Orderings',
      ['A', 'B'],
      ['B', 'A', 'X'],
      ['A', 'B', 'Y'],
      [L, 'B', 'A', 'X', A, 'A', 'B', S, 'A', 'B', 'Y', O],
    ],
    [
      'C8: Delete vs Modify (Other Deletes)',
      ['A', 'B'],
      ['A', 'B:B_MOD'],
      ['A'],
      ['A', L, 'B_MOD', A, 'B', S, O],
    ],
    [
      'C9: Concurrent Addition of Same Key with Different Values',
      ['A'],
      ['A', 'B:B_LOCAL'],
      ['A', 'B:B_OTHER'],
      ['A', L, 'B_LOCAL', A, S, 'B_OTHER', O],
    ],
    [
      'C10: Divergent deletions in same gap (local deletes B, other deletes C)',
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'D'],
      ['A', 'B', 'D'],
      ['A', L, 'C', A, 'B', 'C', S, 'B', O, 'D'],
    ],
  ]

  // Additional scenarios to exercise gap analysis and spine processing branches
  const additionalGracefulScenarios: GracefulMergeScenario[] = [
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
  ]

  describe('Additional Graceful Merges', () => {
    it.each(
      additionalGracefulScenarios
    )('%s', (_name, ancestor, local, other, expectedOutput) => {
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
    })
  })

  describe('Conflicts', () => {
    it.each(
      conflictScenarios
    )('%s', (_name, ancestor, local, other, expectedOutput) => {
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
      expect(extractLabels(result.output)).toEqual(expectedOutput)
    })
  })
})
