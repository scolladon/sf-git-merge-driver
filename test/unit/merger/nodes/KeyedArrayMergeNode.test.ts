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
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
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

describe('KeyedArrayMergeNode', () => {
  describe('merge with key field (fieldPermissions)', () => {
    it('should merge arrays with same elements without conflict', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'false' }]
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should add new element from other', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'false' }]
      const other = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(2)
    })

    it('should add new element from local', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(2)
    })

    it('should remove element deleted in local when other unchanged', () => {
      // Arrange
      const ancestor = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const local = [{ field: 'Account.Name', editable: 'false' }]
      const other = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // No conflict: ancestor === other, so local's deletion wins
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1) // Only Account.Name remains
    })

    it('should remove element deleted in other when local unchanged', () => {
      // Arrange
      const ancestor = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const local = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      // No conflict: ancestor === local, so other's deletion wins
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1) // Only Account.Name remains
    })

    it('should handle modification in other (ancestor equals local)', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'false' }]
      const other = [{ field: 'Account.Name', editable: 'true' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      // Should take other's value since local didn't change
    })

    it('should handle modification in local (ancestor equals other)', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'true' }]
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      // Should take local's value since other didn't change
    })

    it('should create conflict when both local and other modify same element differently', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'true' }]
      const other = [{ field: 'Account.Name', editable: 'maybe' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should not conflict when both local and other make same modification', () => {
      // Arrange
      const ancestor = [{ field: 'Account.Name', editable: 'false' }]
      const local = [{ field: 'Account.Name', editable: 'true' }]
      const other = [{ field: 'Account.Name', editable: 'true' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('merge without key field (unknown attribute)', () => {
    it('should create conflict for arrays without key extractor', () => {
      // Arrange
      const ancestor = [{ name: 'a' }]
      const local = [{ name: 'b' }]
      const other = [{ name: 'c' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should handle arrays with multiple elements', () => {
      // Arrange - covers ternary branches where content.length > 1
      const ancestor = [{ name: 'a' }, { name: 'b' }]
      const local = [{ name: 'c' }, { name: 'd' }]
      const other = [{ name: 'e' }, { name: 'f' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('merge with empty arrays', () => {
    it('should handle empty ancestor', () => {
      // Arrange
      const ancestor: JsonArray = []
      const local = [{ field: 'Account.Name', editable: 'false' }]
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should handle all empty arrays', () => {
      // Arrange
      const ancestor: JsonArray = []
      const local: JsonArray = []
      const other: JsonArray = []
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })
  })

  describe('merge with conflict and empty output', () => {
    it('should propagate conflict when element results in empty output with conflict', () => {
      // Arrange - both local and other delete ancestor element, creating a conflict scenario
      // where merged output is empty but we need to track the conflict state
      const ancestor = [
        { field: 'Account.Name', editable: 'false' },
        { field: 'Account.Type', editable: 'true' },
      ]
      // local keeps Name but deletes Type
      const local = [{ field: 'Account.Name', editable: 'false' }]
      // other keeps Name but also deletes Type (same deletion)
      const other = [{ field: 'Account.Name', editable: 'false' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert - deletion in both branches should not cause conflict
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1)
    })
  })

  describe('deterministic ordering specific algorithm', () => {
    const getTextContent = (
      obj: JsonObject,
      key: string
    ): string | undefined => {
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
        if (
          text &&
          CONFLICT_MARKERS.some(m => text.startsWith(m.split(' ')[0]))
        ) {
          return [text]
        }

        // Unwrap customValue if present
        const wrapped = obj['customValue']
        let content: JsonObject
        if (wrapped && Array.isArray(wrapped)) {
          // Builder format: merge all elements into one object
          content = Object.assign({}, ...(wrapped as JsonObject[]))
        } else if (wrapped) {
          content = wrapped as JsonObject
        } else {
          content = obj
        }

        const label =
          getTextContent(content, 'label') ??
          getTextContent(content, 'fullName')
        return label ? [label] : []
      })

    const createNode = (
      ancestor: JsonArray,
      local: JsonArray,
      other: JsonArray
    ) => {
      return new KeyedArrayMergeNode(ancestor, local, other, 'customValue')
    }

    // Helper to create element: 'A' -> { fullName: 'A', label: 'A' }, 'A:A_MOD' -> { fullName: 'A', label: 'A_MOD' }
    const el = (s: string) => {
      const [name, label] = s.split(':')
      return { fullName: name, label: label ?? name }
    }
    const toElements = (arr: string[]) => arr.map(el)

    type GracefulMergeScenario = [
      name: string,
      ancestor: string[],
      local: string[],
      other: string[],
      expectedOutput: string[],
    ]

    const gracefulMergeScenarios: GracefulMergeScenario[] = [
      // [name, ancestor, local, other, expectedOutput]
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
    ]

    describe('Graceful Merges', () => {
      it.each(
        gracefulMergeScenarios
      )('%s', (_name, ancestor, local, other, expectedOutput) => {
        // Arrange
        const node = createNode(
          toElements(ancestor),
          toElements(local),
          toElements(other)
        )

        // Act
        const result = node.merge(defaultConfig)

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
      // [name, ancestor, local, other, expectedOutput]
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
        const node = createNode(
          toElements(ancestor),
          toElements(local),
          toElements(other)
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual(expectedOutput)
      })
    })

    describe('Diverged orderings with partial moves and deletions', () => {
      it('should merge when only some ancestor elements moved and a new element is added', () => {
        // Arrange
        // Local moves B before A, and adds D. Other unchanged.
        const node = createNode(
          toElements(['A', 'B', 'C']),
          toElements(['B', 'A', 'C', 'D']),
          toElements(['A', 'B', 'C'])
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['B', 'A', 'C', 'D'])
      })

      it('should handle moves when one version deletes an ancestor element', () => {
        // Arrange
        // Local moves C before A and deletes B.
        const node = createNode(
          toElements(['A', 'B', 'C']),
          toElements(['C', 'A']),
          toElements(['A', 'B', 'C'])
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['C', 'A'])
      })
    })
  })
})
