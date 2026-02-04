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
        const content = wrapped
          ? ((Array.isArray(wrapped) ? wrapped[0] : wrapped) as JsonObject)
          : obj

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

    describe('Graceful Merges', () => {
      // M1: Disjoint Changes (Non-overlapping)
      it('M1: Disjoint Changes', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A_MOD' }, // Modify A
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C_MOD' }, // Modify C
        ]
        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A_MOD', 'B', 'C_MOD'])
      })

      // M2: Identical Changes (Idempotency)
      it('M2: Identical Changes', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [{ fullName: 'A', label: 'A_MOD' }]
        const other = [{ fullName: 'A', label: 'A_MOD' }]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A_MOD'])
      })

      // M3: One-Sided Change (Efficiency)
      it('M3: One-Sided Change', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [{ fullName: 'A', label: 'A' }]
        const other = [{ fullName: 'A', label: 'A_MOD' }] // Only Other changes

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A_MOD'])
      })

      // M4: Only local adds element in gap
      it('M4: One-Sided Addition (Local)', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // B added by local
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ] // unchanged

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'B', 'C'])
      })

      // M5: Only other adds element in gap
      it('M5: One-Sided Addition (Other)', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ] // unchanged
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // B added by other
          { fullName: 'C', label: 'C' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'B', 'C'])
      })

      // M6: Both sides add the same element in gap
      it('M6: Identical Addition (Both)', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // B added
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // Same B added
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'B'])
      })

      // M7: Local deletes element, other keeps unchanged (accepts deletion)
      it('M7: One-Sided Deletion (Local)', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          // B deleted
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // B kept unchanged
          { fullName: 'C', label: 'C' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'C']) // B removed
      })

      // M8: Other deletes element, local keeps unchanged (accepts deletion)
      it('M8: One-Sided Deletion (Other)', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // B kept unchanged
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          // B deleted
          { fullName: 'C', label: 'C' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'C']) // B removed
      })

      // M9: Both sides delete the same element (setsEqual returns true)
      it('M9: Identical Deletion', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          // B deleted
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          // B deleted (same deletion)
          { fullName: 'C', label: 'C' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['A', 'C'])
      })

      // M10: Swap Elements - disjoint swaps in local and other should both apply
      it('M10: Swap Elements', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        // Local swaps A and B
        const local = [
          { fullName: 'B', label: 'B' },
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        // Other swaps C and D
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'D', label: 'D' },
          { fullName: 'C', label: 'C' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        expect(extractLabels(result.output)).toEqual(['B', 'A', 'D', 'C'])
      })

      // M10+: Swap Elements with additions - disjoint swaps plus additions from both sides
      it('M10: Swap Elements with additions', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        // Local swaps A and B, adds X
        const local = [
          { fullName: 'B', label: 'B' },
          { fullName: 'A', label: 'A' },
          { fullName: 'X', label: 'X' },
        ]
        // Other keeps order, adds Y
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'Y', label: 'Y' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(false)
        // Expect: B, A (local's swap), X (local's addition), Y (other's addition)
        expect(extractLabels(result.output)).toEqual(['B', 'A', 'X', 'Y'])
      })
    })

    describe('Conflicts', () => {
      // C1: Concurrent Element Modification
      it('C1: Concurrent Modification', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [{ fullName: 'A', label: 'A_LOCAL' }]
        const other = [{ fullName: 'A', label: 'A_OTHER' }]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual([
          expect.stringContaining(LOCAL_CONFLICT_MARKER),
          'A_LOCAL',
          expect.stringContaining(ANCESTOR_CONFLICT_MARKER),
          'A',
          expect.stringContaining(SEPARATOR),
          'A_OTHER',
          expect.stringContaining(OTHER_CONFLICT_MARKER),
        ])
      })

      // C2: Concurrent Insertion (Collision in gap)
      it('C2: Concurrent Insertion', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' }, // Insert B after A
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' }, // Insert C after A
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual([
          'A',
          expect.stringContaining(LOCAL_CONFLICT_MARKER),
          'B',
          expect.stringContaining(ANCESTOR_CONFLICT_MARKER),
          expect.stringContaining(SEPARATOR),
          'C',
          expect.stringContaining(OTHER_CONFLICT_MARKER),
        ])
      })

      // C3: Delete vs Modify
      it('C3: Delete vs Modify', () => {
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local: JsonArray = [] // Delete A
        const other = [{ fullName: 'A', label: 'A_MOD' }] // Modify A

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual([
          expect.stringContaining(LOCAL_CONFLICT_MARKER),
          expect.stringContaining(ANCESTOR_CONFLICT_MARKER),
          'A',
          expect.stringContaining(SEPARATOR),
          'A_MOD',
          expect.stringContaining(OTHER_CONFLICT_MARKER),
        ])
      })

      // C4: Divergent Moves
      it('C4: Divergent Moves', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        // Local moves B before A
        const local = [
          { fullName: 'B', label: 'B' },
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        // Other moves B after C
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
          { fullName: 'B', label: 'B' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual([
          expect.stringContaining(LOCAL_CONFLICT_MARKER),
          'B',
          'A',
          'C',
          expect.stringContaining(ANCESTOR_CONFLICT_MARKER),
          'A',
          'B',
          'C',
          expect.stringContaining(SEPARATOR),
          'A',
          'C',
          'B',
          expect.stringContaining(OTHER_CONFLICT_MARKER),
        ])
      })

      // C5: Partially Overlapping Hunks (Hunk granularity test)
      // Local deletes B, C. Other deletes C. Conflict on B?
      // Actually, if Local deletes B and C, and Other just deletes C (keeps B), then B is "Delete vs Keep".
      // And C is "Delete vs Delete" (Merge).
      // So distinct conflict on B.
      it('C5: Partially Overlapping Hunks', () => {
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        // Local deletes B, C
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'D', label: 'D' },
        ]
        // Other deletes C (Keeps B)
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'D', label: 'D' },
        ]

        const node = createNode(ancestor, local, other)
        const result = node.merge(defaultConfig)

        expect(result.hasConflict).toBe(true)
        expect(extractLabels(result.output)).toEqual([
          'A',
          expect.stringContaining(LOCAL_CONFLICT_MARKER),
          expect.stringContaining(ANCESTOR_CONFLICT_MARKER),
          'B',
          'C',
          expect.stringContaining(SEPARATOR),
          'B',
          expect.stringContaining(OTHER_CONFLICT_MARKER),
          'D',
        ])
      })
    })
  })
})
