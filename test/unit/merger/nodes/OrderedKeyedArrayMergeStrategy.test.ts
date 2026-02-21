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
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

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
  ]

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
