import { describe, expect, it } from 'vitest'
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { MetadataService } from '../../../../src/service/MetadataService.js'
import { isConflictBlock } from '../../../../src/types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const fieldPermissionsKey =
  MetadataService.getKeyFieldExtractor('fieldPermissions')
const picklistValueKey = MetadataService.getKeyFieldExtractor('value')

const permission = (token: string) => {
  const [field, editable] = token.split(':')
  return { field, editable: editable === 't' ? 'true' : 'false' }
}

const entriesOf = (spec: string) =>
  spec === '' ? [] : spec.split(' ').map(permission)

const wrapTokens = (spec: string) =>
  entriesOf(spec).map(entry => ({ fieldPermissions: entry }))

const keyedNode = (ancestor: string, local: string, other: string) =>
  new KeyedArrayMergeNode(
    entriesOf(ancestor),
    entriesOf(local),
    entriesOf(other),
    'fieldPermissions',
    fieldPermissionsKey,
    false
  )

const tokens = (output: JsonArray): string =>
  output
    .map(item => {
      const { field, editable } = (
        item as { fieldPermissions: { field: string; editable: string } }
      ).fieldPermissions
      return `${field}:${editable === 'true' ? 't' : 'f'}`
    })
    .join(',')

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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    describe('given entries carrying attributes', () => {
      describe('when each side edits a different entry', () => {
        it('then both edits merge and the attributes stay on their entries', () => {
          // Arrange
          const item = (field: string, readable = 'false') => ({
            '@_n1:nil': 'false',
            field,
            readable,
          })
          const sut = new KeyedArrayMergeNode(
            [item('Account.X__c'), item('Account.Y__c')],
            [item('Account.X__c', 'true'), item('Account.Y__c')],
            [item('Account.X__c'), item('Account.Y__c', 'true')],
            'fieldPermissions',
            fieldPermissionsKey,
            false
          )

          // Act
          const result = sut.merge(defaultConfig)

          // Assert
          expect(result).toEqual({
            output: [
              { fieldPermissions: item('Account.X__c', 'true') },
              { fieldPermissions: item('Account.Y__c', 'true') },
            ],
            hasConflict: false,
          })
        })
      })
    })
  })

  describe('merge with key field and isOrdered=true (picklist value)', () => {
    it('should merge arrays with same elements without conflict', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'false' }]
      const other = [{ fullName: 'Hot', default: 'false' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should add new element from other', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'false' }]
      const other = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(2)
    })

    it('should add new element from local', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const other = [{ fullName: 'Hot', default: 'false' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(2)
    })

    it('should remove element deleted in local when other unchanged', () => {
      // Arrange
      const ancestor = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const local = [{ fullName: 'Hot', default: 'false' }]
      const other = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1)
    })

    it('should remove element deleted in other when local unchanged', () => {
      // Arrange
      const ancestor = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const local = [
        { fullName: 'Hot', default: 'false' },
        { fullName: 'Warm', default: 'false' },
      ]
      const other = [{ fullName: 'Hot', default: 'false' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1)
    })

    it('should handle modification in other (ancestor equals local)', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'false' }]
      const other = [{ fullName: 'Hot', default: 'true' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should handle modification in local (ancestor equals other)', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'true' }]
      const other = [{ fullName: 'Hot', default: 'false' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should create conflict when both local and other modify same element differently', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'true' }]
      const other = [{ fullName: 'Hot', default: 'maybe' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should not conflict when both local and other make same modification', () => {
      // Arrange
      const ancestor = [{ fullName: 'Hot', default: 'false' }]
      const local = [{ fullName: 'Hot', default: 'true' }]
      const other = [{ fullName: 'Hot', default: 'true' }]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should accept reorder when only one side reorders', () => {
      // Arrange — local moves Warm before Hot; other keeps ancestor order
      const ancestor = [
        { fullName: 'Hot' },
        { fullName: 'Warm' },
        { fullName: 'Cold' },
      ]
      const local = [
        { fullName: 'Warm' },
        { fullName: 'Hot' },
        { fullName: 'Cold' },
      ]
      const other = [
        { fullName: 'Hot' },
        { fullName: 'Warm' },
        { fullName: 'Cold' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(3)
    })

    it('should conflict when both sides reorder overlapping elements (C4)', () => {
      // Arrange — local swaps Hot/Warm; other swaps Warm/Cold; Warm moves in both
      const ancestor = [
        { fullName: 'Hot' },
        { fullName: 'Warm' },
        { fullName: 'Cold' },
      ]
      const local = [
        { fullName: 'Warm' },
        { fullName: 'Hot' },
        { fullName: 'Cold' },
      ]
      const other = [
        { fullName: 'Hot' },
        { fullName: 'Cold' },
        { fullName: 'Warm' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should conflict when same element is added at different positions (C6)', () => {
      // Arrange — both sides add 'Lukewarm' but at different positions
      const ancestor = [{ fullName: 'Hot' }, { fullName: 'Cold' }]
      const local = [
        { fullName: 'Lukewarm' },
        { fullName: 'Hot' },
        { fullName: 'Cold' },
      ]
      const other = [
        { fullName: 'Hot' },
        { fullName: 'Cold' },
        { fullName: 'Lukewarm' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should conflict when disjoint additions coexist with diverged reorder (C7)', () => {
      // Arrange — local reorders Hot/Cold and adds Warm; other adds disjoint Frozen
      const ancestor = [{ fullName: 'Hot' }, { fullName: 'Cold' }]
      const local = [
        { fullName: 'Cold' },
        { fullName: 'Hot' },
        { fullName: 'Warm' },
      ]
      const other = [
        { fullName: 'Hot' },
        { fullName: 'Cold' },
        { fullName: 'Frozen' },
      ]
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'value',
        picklistValueKey,
        true
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('given an array without a key extractor', () => {
    describe('when every side changed it differently', () => {
      it('then one block holds the three versions of the replaced entries', () => {
        // Arrange
        const wrapped = (...names: string[]) =>
          names.map(name => ({ unknownAttribute: { name } }))
        const sut = new KeyedArrayMergeNode(
          [{ name: 'a' }, { name: 'b' }],
          [{ name: 'c' }, { name: 'd' }],
          [{ name: 'e' }, { name: 'f' }],
          'unknownAttribute',
          undefined,
          false
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: wrapped('c', 'd'),
              ancestor: wrapped('a', 'b'),
              other: wrapped('e', 'f'),
            },
          ],
          hasConflict: true,
        })
      })
    })

    describe('when the ancestor was empty', () => {
      it('then both sides inserted an entry in one block with an empty ancestor', () => {
        // Arrange
        const sut = new KeyedArrayMergeNode(
          [],
          [{ name: 'c' }],
          [{ name: 'e' }],
          'unknownAttribute',
          undefined,
          false
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: [{ unknownAttribute: { name: 'c' } }],
              ancestor: [],
              other: [{ unknownAttribute: { name: 'e' } }],
            },
          ],
          hasConflict: true,
        })
      })
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
        'unknownAttribute',
        undefined,
        false
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
        'unknownAttribute',
        undefined,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should not conflict when the unkeyed array is unchanged on all three sides', () => {
      // Arrange — same content everywhere; only present because a sibling
      // property elsewhere forced a walk into this node.
      const ancestor = [{ x: '1' }, { x: '2' }]
      const local = [{ x: '1' }, { x: '2' }]
      const other = [{ x: '1' }, { x: '2' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute',
        undefined,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        { unknownAttribute: { x: '1' } },
        { unknownAttribute: { x: '2' } },
      ])
    })

    it('should not conflict when only local added the unkeyed array', () => {
      // Arrange — ancestor and other agree (both absent); local alone changed.
      const ancestor: JsonArray = []
      const local = [{ x: '1' }]
      const other: JsonArray = []
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute',
        undefined,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ unknownAttribute: { x: '1' } }])
    })

    it('should not conflict when only other added the unkeyed array', () => {
      // Arrange — ancestor and local agree (both absent); other alone changed.
      const ancestor: JsonArray = []
      const local: JsonArray = []
      const other = [{ x: '1' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute',
        undefined,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ unknownAttribute: { x: '1' } }])
    })

    it('should not conflict when local and other converge on the same change', () => {
      // Arrange — ancestor differs from both, but local and other agree.
      const ancestor = [{ x: '0' }]
      const local = [{ x: '1' }]
      const other = [{ x: '1' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute',
        undefined,
        false
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ unknownAttribute: { x: '1' } }])
    })

    it('should still conflict when all three sides genuinely differ', () => {
      // Arrange — regression guard: equality fast paths must not swallow a
      // real divergence with no matching pair.
      const ancestor = [{ x: '0' }]
      const local = [{ x: '1' }]
      const other = [{ x: '2' }]
      const node = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownAttribute',
        undefined,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
        'fieldPermissions',
        fieldPermissionsKey,
        false
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
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions',
        fieldPermissionsKey,
        false
      )

      // Act
      const result = sut.merge(defaultConfig)

      // Assert - deletion in both branches should not cause conflict
      expect(result.hasConflict).toBe(false)
      expect(result.output.length).toBe(1)
    })
  })

  describe('given keyed entries without their key field', () => {
    const entry1 = { editable: 'false', readable: 'false' }
    const entry2 = { editable: 'false', readable: 'true' }
    const edited1 = { editable: 'true', readable: 'false' }
    const edited2 = { editable: 'true', readable: 'true' }
    const build = (ancestor: JsonArray, local: JsonArray, other: JsonArray) =>
      new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions',
        fieldPermissionsKey,
        false
      )
    const wrap = (...entries: JsonArray) =>
      entries.map(item => ({ fieldPermissions: item }))

    describe('when two entries share no key and only local edits one', () => {
      it('then it keeps both entries with the edit and no conflict', () => {
        // Arrange
        const sut = build([entry1, entry2], [edited1, entry2], [entry1, entry2])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited1, entry2))
      })
    })

    describe('when two entries share no key and each side edits another', () => {
      it('then each replacement keeps the place of its entry and both merge', () => {
        // Arrange
        const sut = build(
          [entry1, entry2],
          [edited1, entry2],
          [entry1, edited2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited1, edited2))
      })
    })

    describe('when keyless entries stand apart and each side edits another', () => {
      it('then both edits merge', () => {
        // Arrange
        const middle = { editable: 'false', readable: 'maybe' }
        const sut = build(
          [entry1, middle, entry2],
          [edited1, middle, entry2],
          [entry1, middle, edited2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited1, middle, edited2))
      })
    })

    describe('when one side deletes an entry that the other edits', () => {
      it('then it merges as the entry removed and the edit added', () => {
        // Arrange
        const sut = build([entry1, entry2], [entry2], [edited1, entry2])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited1, entry2))
      })
    })

    describe('when both sides edit one entry differently', () => {
      it('then the two edits are insertions at the place of the removed entry', () => {
        // Arrange
        const otherEdit = { ...entry1, readable: 'maybe' }
        const sut = build(
          [entry1, entry2],
          [edited1, entry2],
          [otherEdit, entry2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.output[0]).toEqual({
          __conflict: true,
          local: wrap(edited1),
          ancestor: wrap(entry1),
          other: wrap(otherEdit),
        })
      })
    })

    describe('when keyed entries sit among keyless ones', () => {
      const keyedA = { field: 'A', editable: 'false' }
      const keyedB = { field: 'B', editable: 'false' }

      it('then a swap of edited keyed entries keeps each conflict on its entry', () => {
        // Arrange
        const edited = (entry: JsonObject, editable: string) => ({
          ...entry,
          editable,
        })
        const sut = build(
          [keyedA, keyedB, entry1, entry2],
          [edited(keyedB, 'true'), edited(keyedA, 'true'), entry1, entry2],
          [edited(keyedA, 'maybe'), keyedB, entry1, entry2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.output).toEqual([
          ...wrap(edited(keyedB, 'true')),
          {
            fieldPermissions: [
              { field: 'A' },
              {
                __conflict: true,
                local: [{ editable: 'true' }],
                ancestor: [{ editable: 'false' }],
                other: [{ editable: 'maybe' }],
              },
            ],
          },
          ...wrap(entry1, entry2),
        ])
      })

      it('then both sides editing one keyed entry conflict inside that entry', () => {
        // Arrange
        const sut = build(
          [keyedA, entry1, entry2],
          [{ ...keyedA, editable: 'true' }, entry1, entry2],
          [{ ...keyedA, editable: 'maybe' }, entry1, entry2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.output[0]).toEqual({
          fieldPermissions: [
            { field: 'A' },
            {
              __conflict: true,
              local: [{ editable: 'true' }],
              ancestor: [{ editable: 'false' }],
              other: [{ editable: 'maybe' }],
            },
          ],
        })
      })
    })

    describe('when a real key is spelled like the signature of a keyless entry', () => {
      it('then the keyed entry stays distinct from that entry', () => {
        // Arrange
        const lookalike = {
          field: JSON.stringify(entry1),
          editable: 'true',
        }
        const edited = { ...lookalike, editable: 'false' }
        const sut = build(
          [lookalike, entry1, entry2],
          [edited, edited1, entry2],
          [lookalike, entry2]
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited, edited1, entry2))
      })
    })

    describe('when only the ancestor holds the colliding entries', () => {
      it('then it resolves to the keyless entry both sides share', () => {
        // Arrange
        const sut = build([entry1, entry2], [entry1], [entry1])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(entry1))
      })
    })

    describe('when local deleted the array and other edits an entry', () => {
      it('then the edit is the only entry left and nothing conflicts', () => {
        // Arrange
        const sut = build([entry1, entry2], [], [edited1, entry2])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual(wrap(edited1))
      })
    })

    describe('when ordered entries share no key', () => {
      const buildOrdered = (
        ancestor: JsonArray,
        local: JsonArray,
        other: JsonArray
      ) =>
        new KeyedArrayMergeNode(
          ancestor,
          local,
          other,
          'value',
          picklistValueKey,
          true
        )
      const x = { label: 'x' }
      const y = { label: 'y' }
      const xEdited = { label: 'x2' }
      const yEdited = { label: 'y2' }

      it('then edits of neighbours on each side both merge', () => {
        // Arrange
        const sut = buildOrdered([x, y], [xEdited, y], [x, yEdited])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([{ value: xEdited }, { value: yEdited }])
      })

      it('then a one-sided edit resolves with both entries', () => {
        // Arrange
        const sut = buildOrdered([x, y], [xEdited, y], [x, y])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([{ value: xEdited }, { value: y }])
      })
    })

    describe('when each side holds a lone keyless entry', () => {
      it('then divergent replacements of the content conflict at one place', () => {
        // Arrange
        const otherEdit = { ...entry1, readable: 'true' }
        const sut = build([entry1], [edited1], [otherEdit])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.output).toEqual([
          {
            __conflict: true,
            local: [{ fieldPermissions: edited1 }],
            ancestor: [{ fieldPermissions: entry1 }],
            other: [{ fieldPermissions: otherEdit }],
          },
        ])
      })

      it('then a one-sided edit is the old content removed and the new added', () => {
        // Arrange
        const sut = build([entry1], [edited1], [entry1])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([{ fieldPermissions: edited1 }])
      })
    })
  })

  describe('given entries sharing a real key', () => {
    describe('when unordered', () => {
      it('then every copy is kept', () => {
        // Arrange
        const first = { field: 'Account.X__c', editable: 'false' }
        const last = { field: 'Account.X__c', editable: 'true' }
        const added = { field: 'Account.Y__c', editable: 'false' }
        const sut = new KeyedArrayMergeNode(
          [first, last],
          [first, last],
          [first, last, added],
          'fieldPermissions',
          fieldPermissionsKey,
          false
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([
          { fieldPermissions: first },
          { fieldPermissions: last },
          { fieldPermissions: added },
        ])
      })

      describe.each([
        ['A:f A:t', 'A:f A:t', 'A:f A:t', 'A:f,A:t'],
        ['A:f A:t', 'A:f A:t', 'A:f A:t B:f', 'A:f,A:t,B:f'],
        ['A:f A:t', 'A:t', 'A:f A:f', 'A:f'],
        ['A:f A:t', 'A:f A:t', 'A:t', 'A:t'],
        ['A:f A:t', 'A:t A:f', 'A:f A:t', 'A:t,A:f'],
        ['A:f A:t', 'A:f A:t', 'A:t A:f', 'A:t,A:f'],
        ['', 'A:f A:t', '', 'A:f,A:t'],
        ['', 'A:f A:t A:f', 'A:f', 'A:f,A:t,A:f'],
        ['', 'A:f', 'A:f A:t', 'A:f,A:t'],
        ['A:f A:f', 'A:f', 'A:f B:f', 'A:f,B:f'],
      ])('given %s / %s / %s', (ancestor, local, other, expected) => {
        it('then the clean outcome is the settled copies', () => {
          // Arrange
          const sut = keyedNode(ancestor, local, other)

          // Act
          const result = sut.merge(defaultConfig)

          // Assert
          expect(result.hasConflict).toBe(false)
          expect(tokens(result.output)).toBe(expected)
        })
      })

      describe.each([
        ['A:f A:f', 'A:t A:f', 'A:f A:t'],
        ['A:f A:f', 'A:t', 'A:f'],
        ['A:f A:f', 'A:f', 'A:t'],
        ['A:f', '', 'A:t A:t'],
      ])('given %s / %s / %s', (ancestor, local, other) => {
        it('then the key is one block of its written copies', () => {
          // Arrange
          const sut = keyedNode(ancestor, local, other)

          // Act
          const result = sut.merge(defaultConfig)

          // Assert
          expect(result.hasConflict).toBe(true)
          expect(result.output).toHaveLength(1)
          const [block] = result.output
          expect(isConflictBlock(block)).toBe(true)
          expect(block).toMatchObject({
            local: wrapTokens(local),
            ancestor: wrapTokens(ancestor),
            other: wrapTokens(other),
          })
        })
      })
    })

    describe('when ordered', () => {
      it('then every entry is written as given', () => {
        // Arrange
        const a1 = { fullName: 'A', label: 'A1' }
        const a2 = { fullName: 'A', label: 'A2' }
        const b = { fullName: 'B', label: 'B' }
        const sut = new KeyedArrayMergeNode(
          [a1, a2, b],
          [a1, a2, b],
          [a1, a2, b],
          'customValue',
          MetadataService.getKeyFieldExtractor('customValue'),
          true
        )

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toEqual([
          { customValue: a1 },
          { customValue: a2 },
          { customValue: b },
        ])
      })
    })
  })

  describe('given an unordered keyed array', () => {
    const entry = (field: string, editable = 'false') => ({ field, editable })
    const whole = (item: object) => ({ fieldPermissions: item })
    const mergeUnordered = (
      ancestor: JsonArray,
      local: JsonArray,
      other: JsonArray
    ) =>
      new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'fieldPermissions',
        fieldPermissionsKey,
        false
      ).merge(defaultConfig)

    describe('when local deletes an entry that other edits', () => {
      it('then one block holds the whole entry at array level', () => {
        // Arrange
        const ancestor = [entry('A'), entry('B')]
        const local = [entry('B')]
        const other = [entry('A', 'true'), entry('B')]

        // Act
        const result = mergeUnordered(ancestor, local, other)

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: [],
              ancestor: [whole(entry('A'))],
              other: [whole(entry('A', 'true'))],
            },
            whole(entry('B')),
          ],
          hasConflict: true,
        })
      })
    })

    describe('when other deletes an entry that local edits', () => {
      it('then one block holds the whole entry at array level', () => {
        // Arrange
        const ancestor = [entry('A'), entry('B')]
        const local = [entry('A', 'true'), entry('B')]
        const other = [entry('B')]

        // Act
        const result = mergeUnordered(ancestor, local, other)

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: [whole(entry('A', 'true'))],
              ancestor: [whole(entry('A'))],
              other: [],
            },
            whole(entry('B')),
          ],
          hasConflict: true,
        })
      })
    })

    describe('when only other edited an entry', () => {
      it('then the entry is emitted whole', () => {
        // Arrange
        const ancestor = [entry('A')]
        const local = [entry('A')]
        const other = [entry('A', 'true')]

        // Act
        const result = mergeUnordered(ancestor, local, other)

        // Assert
        expect(result).toEqual({
          output: [whole(entry('A', 'true'))],
          hasConflict: false,
        })
      })
    })

    describe('when local deletes an entry that other edited with a hidden field', () => {
      it('then one block holds the entry', () => {
        // Arrange
        const hidden = { field: 'A', editable: 'false', hidden: 'true' }

        // Act
        const result = mergeUnordered([entry('A')], [], [hidden])

        // Assert
        expect(result.output).toEqual([
          {
            __conflict: true,
            local: [],
            ancestor: [whole(entry('A'))],
            other: [whole(hidden)],
          },
        ])
      })
    })

    describe('when both sides insert one entry with different content', () => {
      it('then one field block sits inside the entry', () => {
        // Arrange
        const ancestor = [entry('A')]
        const local = [entry('A'), entry('C', 'true')]
        const other = [entry('A'), entry('C', 'maybe')]

        // Act
        const result = mergeUnordered(ancestor, local, other)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(result.output).toHaveLength(2)
        expect(result.output[0]).toEqual(whole(entry('A')))
        const inserted = (result.output[1] as { fieldPermissions: JsonArray })
          .fieldPermissions
        expect(inserted.filter(isConflictBlock)).toHaveLength(1)
      })
    })

    describe('when each side deletes a different field of a keyless entry', () => {
      it('then both replacements of the content conflict at one place', () => {
        // Arrange
        const ancestor = [{ editable: 'true', readable: 'true' }]
        const local = [{ editable: 'true' }]
        const other = [{ readable: 'true' }]

        // Act
        const result = mergeUnordered(ancestor, local, other)

        // Assert
        expect(result).toEqual({
          hasConflict: true,
          output: [
            {
              __conflict: true,
              local: [{ fieldPermissions: local[0] }],
              ancestor: [{ fieldPermissions: ancestor[0] }],
              other: [{ fieldPermissions: other[0] }],
            },
          ],
        })
      })
    })

    describe('when both sides edit one entry carrying attributes', () => {
      it('then the entry conflicts as one text unit with its attributes', () => {
        // Arrange
        const item = (editable: string) => ({
          '@_n1:nil': 'false',
          field: 'A',
          editable,
        })

        // Act
        const result = mergeUnordered([item('f')], [item('t')], [item('m')])

        // Assert
        expect(result).toEqual({
          output: [
            {
              __conflict: true,
              local: [whole(item('t'))],
              ancestor: [whole(item('f'))],
              other: [whole(item('m'))],
            },
          ],
          hasConflict: true,
        })
      })
    })

    describe('when both sides edit one entry on different fields', () => {
      it('then both edits merge without conflict', () => {
        // Arrange
        const base = { field: 'A', editable: 'false', readable: 'false' }
        const local = { ...base, editable: 'true' }
        const other = { ...base, readable: 'true' }

        // Act
        const result = mergeUnordered([base], [local], [other])

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(JSON.stringify(result.output)).toContain('"editable":"true"')
        expect(JSON.stringify(result.output)).toContain('"readable":"true"')
      })
    })
  })

  describe('given a keyless list of twelve entries', () => {
    // Linear code takes a few ms here, even under coverage; the version that
    // paired every edited entry with every unused ancestor copy cannot finish.
    const SIZE = 12
    const BUDGET_MS = 500
    const TEST_TIMEOUT_MS = 20_000
    const entry = (index: number, edit = '') => ({ name: `e${index}${edit}` })
    const ancestor = Array.from({ length: SIZE }, (_, index) => entry(index))
    const editedBy = (edit: string) =>
      ancestor.map((_, index) => entry(index, edit))
    const timedMerge = (local: JsonArray, other: JsonArray): number => {
      const sut = new KeyedArrayMergeNode(
        ancestor,
        local,
        other,
        'unknownThing',
        undefined,
        false
      )
      const start = performance.now()
      sut.merge(defaultConfig)
      return performance.now() - start
    }

    describe('when one side edits every entry', () => {
      it(
        'then it merges within the budget',
        () => {
          // Arrange
          const local = editedBy('-local')

          // Act
          const elapsed = timedMerge(local, ancestor)

          // Assert
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        TEST_TIMEOUT_MS
      )
    })

    describe('when both sides edit every entry', () => {
      it(
        'then it merges within the budget',
        () => {
          // Arrange
          const local = editedBy('-local')
          const other = editedBy('-other')

          // Act
          const elapsed = timedMerge(local, other)

          // Assert
          expect(elapsed).toBeLessThan(BUDGET_MS)
        },
        TEST_TIMEOUT_MS
      )
    })
  })

  describe('given entries of equal content whose child tags are in different orders', () => {
    const inOrder = (tags: readonly string[], values: JsonObject) =>
      Object.fromEntries(tags.map(tag => [tag, values[tag]]))
    const unorderedKeyed = (trio: readonly [JsonArray, JsonArray, JsonArray]) =>
      new KeyedArrayMergeNode(
        ...trio,
        'fieldPermissions',
        fieldPermissionsKey,
        false
      )
    const orderedKeyed = (trio: readonly [JsonArray, JsonArray, JsonArray]) =>
      new KeyedArrayMergeNode(...trio, 'value', picklistValueKey, true)
    const keyless = (trio: readonly [JsonArray, JsonArray, JsonArray]) =>
      new KeyedArrayMergeNode(...trio, 'thing', undefined, false)
    const SHAPES = [
      ['an unordered keyed array', unorderedKeyed, 'field'],
      ['an ordered keyed array', orderedKeyed, 'fullName'],
      ['a keyless array', keyless, 'label'],
    ] as const
    const ANCESTOR = ['a', 'b', 'c']
    const OURS = ['b', 'a', 'c']
    const THEIRS = ['a', 'c', 'b']
    const values = { a: '1', b: '2', c: '3', field: 'F', fullName: 'F' }

    const entriesIn = (keyTag: string, tags: readonly string[]): JsonArray => [
      inOrder([keyTag, ...tags], values),
    ]

    describe('when a key is repeated in an unordered keyed array', () => {
      it('then the cycle among the tag orders of the copies conflicts', () => {
        // Arrange
        const twice = (tags: readonly string[]): JsonArray => [
          ...entriesIn('field', tags),
          ...entriesIn('field', tags),
        ]
        const sut = unorderedKeyed([
          twice(ANCESTOR),
          twice(OURS),
          twice(THEIRS),
        ])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })

    describe.each(SHAPES)('when %s', (_shape, build, keyTag) => {
      it.each([
        ['ours', OURS, THEIRS],
        ['theirs', THEIRS, OURS],
      ])(
        'then the cycle among the tag orders conflicts whichever side is %s',
        (_side, local, other) => {
          // Arrange
          const sut = build([
            entriesIn(keyTag, ANCESTOR),
            entriesIn(keyTag, local),
            entriesIn(keyTag, other),
          ])

          // Act
          const result = sut.merge(defaultConfig)

          // Assert
          expect(result.hasConflict).toBe(true)
        }
      )

      it('then an entry both sides add with disagreeing tag orders conflicts', () => {
        // Arrange
        const sut = build([
          [],
          entriesIn(keyTag, OURS),
          entriesIn(keyTag, THEIRS),
        ])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('then a reorder only one side made is kept', () => {
        // Arrange
        const sut = build([
          entriesIn(keyTag, ANCESTOR),
          entriesIn(keyTag, OURS),
          entriesIn(keyTag, ANCESTOR),
        ])

        // Act
        const result = sut.merge(defaultConfig)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(JSON.stringify(result.output)).toBe(
          JSON.stringify(
            build([
              entriesIn(keyTag, OURS),
              entriesIn(keyTag, OURS),
              entriesIn(keyTag, OURS),
            ]).merge(defaultConfig).output
          )
        )
      })
    })
  })
})
