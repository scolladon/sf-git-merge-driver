import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

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
    // Helper to extract values from result for easy verification
    const extractValues = (result: JsonArray): unknown[] => {
      return result.flatMap(item => {
        if (!item) return []
        // If item is an array (content block in conflict), map each element
        if (Array.isArray(item)) {
          return extractValues(item)
        }

        const obj = item as JsonObject

        if (obj['#text'] && typeof obj['#text'] === 'string') {
          const text = obj['#text'].trim()
          if (
            text.startsWith('<') ||
            text.startsWith('|') ||
            text.startsWith('=') ||
            text.startsWith('>')
          ) {
            return text
          }
        }

        let content = obj as JsonObject
        // Unwrap if wrapped in attribute name (customValue)
        if (obj['customValue']) {
          const val = obj['customValue']
          content = (Array.isArray(val) ? val[0] : val) as JsonObject
        }

        // Handle array values for properties (XML convention)
        const getProp = (o: JsonObject, key: string) => {
          if (!o) return undefined
          const val = o[key]
          if (Array.isArray(val) && val.length > 0) {
            const first = val[0] as JsonObject
            if (first?.['#text']) return first['#text']
            return first
          }
          return val
        }

        const res = getProp(content, 'label') ?? getProp(content, 'fullName')
        return res
      })
    }

    describe('Graceful Merges', () => {
      // M1: Non-overlapping hunks - L changes [1-2], O changes [5-6] -> Merge
      it('M1: should merge non-overlapping hunks', () => {
        // Arrange
        const ancestor = [
          { fullName: '1', label: '1' },
          { fullName: '2', label: '2' },
          { fullName: '3', label: '3' },
          { fullName: '4', label: '4' },
          { fullName: '5', label: '5' },
          { fullName: '6', label: '6' },
        ]
        const local = [
          { fullName: '1', label: '1A' }, // Changed 1
          { fullName: '2', label: '2A' }, // Changed 2
          { fullName: '3', label: '3' },
          { fullName: '4', label: '4' },
          { fullName: '5', label: '5' },
          { fullName: '6', label: '6' },
        ]
        const other = [
          { fullName: '1', label: '1' },
          { fullName: '2', label: '2' },
          { fullName: '3', label: '3' },
          { fullName: '4', label: '4' },
          { fullName: '5', label: '5B' }, // Changed 5
          { fullName: '6', label: '6B' }, // Changed 6
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual([
          '1A',
          '2A',
          '3',
          '4',
          '5B',
          '6B',
        ])
      })

      // M2: Identical hunks - Both produce same change -> Merge (dedupe)
      it('M2: should merge identical hunks', () => {
        // Arrange
        const ancestor: JsonArray = [{ fullName: 'A', label: 'A' }]
        const local: JsonArray = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other: JsonArray = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'B'])
      })

      // M3: One side unchanged - Only L or O modified a region -> Take change
      it('M3: should take change when one side is unchanged', () => {
        // Arrange
        const ancestor: JsonArray = [{ fullName: 'A', label: 'A' }]
        const local: JsonArray = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other: JsonArray = [{ fullName: 'A', label: 'A' }]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'B'])
      })

      // M4: Deletions in different regions - L deletes B, O deletes E -> Merge
      it('M4: should merge deletions in different regions', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
          { fullName: 'E', label: 'E' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' }, // Deleted B
          { fullName: 'D', label: 'D' },
          { fullName: 'E', label: 'E' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' }, // Deleted E
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'C', 'D'])
      })

      // M5: Anchor deleted - L inserts after B, O deletes B -> Merge (L inserted after element before B)
      it('M5: should handle insertion when anchor is deleted by other', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ] // Inserted C after B
        const other = [{ fullName: 'A', label: 'A' }] // Deleted B
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        // L inserted C after B. O deleted B.
        // Theoretically C should come after A (since B is gone).
        expect(extractValues(result.output)).toEqual(['A', 'C'])
      })
    })

    describe('Conflicts', () => {
      // C1: Overlapping hunks - Both modify region [1-3] differently -> Conflict
      it('C1: should detect conflict for overlapping hunks', () => {
        // Arrange
        const ancestor = [
          { fullName: '1', label: '1' },
          { fullName: '2', label: '2' },
          { fullName: '3', label: '3' },
        ]
        const local = [
          { fullName: '1', label: '1A' },
          { fullName: '2', label: '2' },
          { fullName: '3', label: '3' },
        ] // Mod 1 -> 1A
        const other = [
          { fullName: '1', label: '1B' },
          { fullName: '2', label: '2' },
          { fullName: '3', label: '3' },
        ] // Mod 1 -> 1B
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          expect.stringContaining('ours'),
          '1A',
          expect.stringContaining('base'),
          '1',
          expect.stringContaining('='),
          '1B',
          expect.stringContaining('theirs'),
          '2',
          '3',
        ])
      })

      // C2: Same-gap inserts - Both insert between A and D -> Conflict
      it('C2: should detect conflict for same-gap inserts', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'D', label: 'D' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'D', label: 'D' },
        ] // Insert B
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ] // Insert C
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          'A',
          expect.stringContaining('ours'),
          'B',
          expect.stringContaining('base'),
          expect.stringContaining('='),
          'C',
          expect.stringContaining('theirs'),
          'D',
        ])
      })

      // C3: Delete vs Modify - L deletes B, O modifies B -> Conflict
      it('C3: should detect conflict for delete vs modify', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const local = [{ fullName: 'A', label: 'A' }] // Delete B
        // Modify B -> B2 (Kept ID 'B', Changed Val 'B2')
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B2' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          'A',
          expect.stringContaining('ours'),
          expect.stringContaining('base'),
          'B',
          expect.stringContaining('='),
          'B2',
          expect.stringContaining('theirs'),
        ])
      })

      // C4: Empty ancestor - [] -> [A,B] vs [] -> [X,Y] -> Conflict
      it('C4: should detect conflict with empty ancestor', () => {
        // Arrange
        const ancestor: JsonArray = []
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other = [
          { fullName: 'X', label: 'X' },
          { fullName: 'Y', label: 'Y' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          expect.stringContaining('ours'),
          'A',
          'B',
          expect.stringContaining('base'),
          expect.stringContaining('='),
          'X',
          'Y',
          expect.stringContaining('theirs'),
        ])
      })

      // C5: Interleaved inserts - L: [A,B,C,D], O: [A,X,Y,D] from [A,D] -> Conflict
      it('C5: should detect conflict for interleaved inserts in same gap', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'D', label: 'D' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'X', label: 'X' },
          { fullName: 'Y', label: 'Y' },
          { fullName: 'D', label: 'D' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          'A',
          expect.stringContaining('ours'),
          'B',
          'C',
          expect.stringContaining('base'),
          expect.stringContaining('='),
          'X',
          'Y',
          expect.stringContaining('theirs'),
          'D',
        ])
      })

      // C6: Conflicting moves - Same batch moved to different positions -> Conflict
      it('C6: should detect conflict for conflicting moves', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'B', label: 'B' },
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ] // Move B before A
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
          { fullName: 'B', label: 'B' },
        ] // Move B after C
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        // Order is ambiguous due to conflict
        // C6: Move conflict - B moved before A vs B moved after C
        // Local: B, A, C
        // Other: A, C, B
        expect(extractValues(result.output)).toEqual([
          expect.stringContaining('ours'),
          'B',
          'A',
          'C',
          expect.stringContaining('base'),
          'A',
          'B',
          'C',
          expect.stringContaining('='),
          'A',
          'C',
          'B',
          expect.stringContaining('theirs'),
        ])
      })
    })

    describe('Edge Cases Matrix', () => {
      // E1: [] vs [A, B] vs [X, Y] -> Conflict
      it('E1: should conflict for [] vs [A, B] vs [X, Y]', () => {
        // Arrange
        const ancestor: JsonArray = []
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other = [
          { fullName: 'X', label: 'X' },
          { fullName: 'Y', label: 'Y' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          expect.stringContaining('ours'),
          'A',
          'B',
          expect.stringContaining('base'),
          expect.stringContaining('='),
          'X',
          'Y',
          expect.stringContaining('theirs'),
        ])
      })

      // E2: [] vs [A, B] vs [A, B] -> Merge [A, B]
      it('E2: should merge [] vs [A, B] vs [A, B]', () => {
        // Arrange
        const ancestor: JsonArray = []
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'B'])
      })

      // E3: [] vs [A] vs [] -> Take Local [A]
      it('E3: should take local for [] vs [A] vs []', () => {
        // Arrange
        const ancestor: JsonArray = []
        const local = [{ fullName: 'A', label: 'A' }]
        const other: JsonArray = []
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A'])
      })

      // E4: [A] vs [A, B] vs [A, C] -> Conflict
      it('E4: should conflict for [A] vs [A, B] vs [A, C]', () => {
        // Arrange
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          'A',
          expect.stringContaining('ours'),
          'B',
          expect.stringContaining('base'),
          expect.stringContaining('='),
          'C',
          expect.stringContaining('theirs'),
        ])
      })

      // E5: [A] vs [] vs [A, B] -> Conflict (delete vs modify/append)
      it('E5: should conflict for [A] vs [] vs [A, B]', () => {
        // Arrange
        const ancestor = [{ fullName: 'A', label: 'A' }]
        const local: JsonArray = [] // Deleted A
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
        ] // Kept A, Added B
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          expect.stringContaining('ours'),
          expect.stringContaining('base'),
          'A',
          expect.stringContaining('='),
          'A',
          'B',
          expect.stringContaining('theirs'),
        ])
      })

      // E6: [A, B, C] vs [A, C] vs [A, X, C] -> Merge [A, X, C]
      it('E6: should merge [A, B, C] vs [A, C] vs [A, X, C]', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ] // Del B
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'X', label: 'X' },
          { fullName: 'C', label: 'C' },
        ] // Del B, Insert X
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'X', 'C'])
      })

      // E7: [A, B, C] vs [A, C] vs [A, C] -> Merge [A, C]
      it('E7: should merge [A, B, C] vs [A, C] vs [A, C]', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'C', label: 'C' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual(['A', 'C'])
      })

      // E8: [A, B, C, D] vs [A, D] vs [A, B, D] -> Conflict around B (delete BC vs delete C)
      // Note: Spec says conflict.
      it('E8: should conflict for [A, B, C, D] vs [A, D] vs [A, B, D]', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'D', label: 'D' },
        ] // Del B, C
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'D', label: 'D' },
        ] // Del C
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(extractValues(result.output)).toEqual([
          'A',
          expect.stringContaining('ours'),
          expect.stringContaining('base'),
          'B',
          'C',
          expect.stringContaining('='),
          'B',
          expect.stringContaining('theirs'),
          'D',
        ])
      })

      // E9: [A, B, C, D] vs [A, X, B, C, D] vs [A, B, C, Y, D] -> Merge [A, X, B, C, Y, D]
      it('E9: should merge [A, B, C, D] vs [A, X, B, C, D] vs [A, B, C, Y, D]', () => {
        // Arrange
        const ancestor = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        const local = [
          { fullName: 'A', label: 'A' },
          { fullName: 'X', label: 'X' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'D', label: 'D' },
        ]
        const other = [
          { fullName: 'A', label: 'A' },
          { fullName: 'B', label: 'B' },
          { fullName: 'C', label: 'C' },
          { fullName: 'Y', label: 'Y' },
          { fullName: 'D', label: 'D' },
        ]
        const node = new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'customValue'
        )

        // Act
        const result = node.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(extractValues(result.output)).toEqual([
          'A',
          'X',
          'B',
          'C',
          'Y',
          'D',
        ])
      })
    })
  })
})
