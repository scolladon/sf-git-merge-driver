import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { buildConflictMarkers } from '../../../../src/merger/ConflictMarkerBuilder.js'
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { generateObj } from '../../../../src/merger/nodes/nodeUtils.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const extractFrom =
  (item: JsonObject) => (key: string) => (attribut: string) => {
    const customValue = item[key] as JsonArray
    const nameObj = customValue.find(
      i => (i as JsonObject)[attribut]
    ) as JsonObject
    return ((nameObj[attribut] as JsonArray)[0] as JsonObject)[TEXT_TAG]
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
    it('when switching order of elements, in Local, should sort keys in deterministic order', () => {
      // Arrange
      const ancestor = [
        { fullName: 'Name', default: 'false', label: 'Name' },
        { fullName: 'Type', default: 'true', label: 'Type' },
      ]
      const local = [
        { fullName: 'Type', default: 'true', label: 'Type' },
        { fullName: 'Name', default: 'false', label: 'Name' },
      ]
      const other = ancestor
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
      expect(result.output.length).toBe(2)

      const firstFullName = extractFrom(result.output[0] as JsonObject)(
        'customValue'
      )('fullName')
      const secondFullName = extractFrom(result.output[1] as JsonObject)(
        'customValue'
      )('fullName')
      expect(firstFullName).toBe('Type')
      expect(secondFullName).toBe('Name')
    })

    it('when switching order of elements, in Others, should sort keys in deterministic order', () => {
      // Arrange
      const ancestor = [
        { fullName: 'Name', default: 'false', label: 'Name' },
        { fullName: 'Type', default: 'true', label: 'Type' },
      ]
      const local = ancestor
      const other = [
        { fullName: 'Type', default: 'true', label: 'Type' },
        { fullName: 'Name', default: 'false', label: 'Name' },
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
      expect(result.output.length).toBe(2)

      const firstFullName = extractFrom(result.output[0] as JsonObject)(
        'customValue'
      )('fullName')
      const secondFullName = extractFrom(result.output[1] as JsonObject)(
        'customValue'
      )('fullName')
      expect(firstFullName).toBe('Type')
      expect(secondFullName).toBe('Name')
    })

    it(' should sort keys in deterministic order', () => {
      // Arrange
      const ancestor = [
        { fullName: 'Name', default: 'false', label: 'Name' },
        { fullName: 'Type', default: 'true', label: 'Type' },
      ]
      const local = [
        { fullName: 'Name', default: 'false', label: 'Name' },
        { fullName: 'Local', default: 'false', label: 'Local' },
        { fullName: 'Type', default: 'true', label: 'Type' },
      ]
      const other = [
        { fullName: 'Name', default: 'false', label: 'Name' },
        { fullName: 'Other', default: 'false', label: 'Other' },
        { fullName: 'Type', default: 'true', label: 'Type' },
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
      expect(result.output.length).toBe(4)

      const conflictMarkers = buildConflictMarkers(
        defaultConfig,
        local[1],
        {},
        other[1]
      )
      expect(result.output).toEqual([
        {
          customValue: [
            generateObj('fullName', 'Name'),
            generateObj('default', 'false'),
            generateObj('label', 'Name'),
          ],
        },
        ...conflictMarkers,
        {
          customValue: [
            generateObj('fullName', 'Type'),
            generateObj('default', 'true'),
            generateObj('label', 'Type'),
          ],
        },
      ])
    })
  })
})
