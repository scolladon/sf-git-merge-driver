import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../../../src/constant/metadataConstant.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import { JsonValue } from '../../../src/types/jsonTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('JsonMerger', () => {
  let sut: JsonMerger

  beforeEach(() => {
    // Arrange - Fresh instance per test, no manual state reset needed!
    sut = new JsonMerger(defaultConfig)
  })

  describe('Merging objects with nested arrays containing key fields', () => {
    it('should correctly merge arrays by using object field properties as unique identifiers', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            {
              field: 'Account.AllAndAncestorAndOther',
              editable: 'false',
              readable: 'true',
            },
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            {
              field: 'Account.AllAndAncestorAndOther',
              editable: 'true',
              readable: 'true',
            },
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            {
              field: 'Account.LocalAndOther',
              editable: 'false',
              readable: 'true',
            },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            {
              field: 'Account.AllAndAncestorAndOther',
              editable: 'false',
              readable: 'true',
            },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            {
              field: 'Account.LocalAndOther',
              editable: 'false',
              readable: 'true',
            },
            { field: 'Account.Type', editable: 'false', readable: 'false' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.AllAndAncestorAndOther' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Industry' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.LocalAndOther' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should resolve conflicts when both sides modify the same array element with different values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should preserve our modifications while incorporating their additions to the array', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('Merging complex objects with multiple data types and different array merging strategies', () => {
    it('should correctly apply appropriate merge strategies for primitive arrays, keyed arrays, and scalar values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our updated description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Original description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          label: 'Their Label',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Our updated description' }],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { label: [{ '#text': 'Their Label' }] },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('Handling XML namespaces in metadata merges', () => {
    it('should correctly position namespace attributes at the appropriate level in the output structure', () => {
      // Arrange
      const ancestor: JsonValue = {
        CustomLabels: {
          labels: {
            fullName: 'tested_label',
            value: 'this is ancestor label',
            language: 'fr',
            protected: 'false',
            shortDescription: 'this is ancestor label',
          },
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      }

      const local: JsonValue = {
        CustomLabels: {
          labels: {
            fullName: 'tested_label',
            value: 'this is ancestor label',
            language: 'fr',
            protected: 'false',
            shortDescription: 'this is ancestor label',
          },
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      }

      const other: JsonValue = {
        CustomLabels: {
          labels: {
            fullName: 'tested_label',
            value: 'this is ancestor label',
            language: 'fr',
            protected: 'false',
            shortDescription: 'this is ancestor label',
          },
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          CustomLabels: [
            {
              labels: [
                { fullName: [{ '#text': 'tested_label' }] },
                { language: [{ '#text': 'fr' }] },
                { protected: [{ '#text': 'false' }] },
                {
                  shortDescription: [{ '#text': 'this is ancestor label' }],
                },
                { value: [{ '#text': 'this is ancestor label' }] },
              ],
            },
          ],
          ':@': {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          },
        },
      ])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('Handling merge conflicts when a common base version is missing or incomplete', () => {
    it('should generate a conflict marker structure when merging divergent changes without a base version', () => {
      // Arrange
      const ancestor = {}

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { description: [{ '#text': 'Their description' }] },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Industry' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| base' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> theirs' },
                { field: [{ '#text': 'Account.Name' }] },
                { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
                { readable: [{ '#text': 'true' }] },
                { '#text': '||||||| base' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { readable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> theirs' },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should generate field-level conflict markers when merging changes with an empty ancestor object', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| base' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> theirs' },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should generate block-level conflict markers when merging changes with an unknown property name', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const local: JsonValue = {
        Profile: {
          unknown: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          unknown: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              unknown: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '||||||| base' },
            { '#text': SALESFORCE_EOL },
            { '#text': '=======' },
            {
              unknown: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('Handling merge conflicts when their version is missing or incomplete', () => {
    it('should generate conflict markers when an empty remote version conflicts with modified field permissions in local', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '||||||| base' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '=======' },
            { '#text': SALESFORCE_EOL },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should correctly merge objects when other is undefined', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          description: 'Their description',
        },
      }

      const local: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const other = {}

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
        { '#text': '||||||| base' },
        {
          Profile: [
            { description: [{ '#text': 'Their description' }] },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Industry' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
        { '#text': '=======' },
        { '#text': SALESFORCE_EOL },
        { '#text': '>>>>>>> theirs' },
      ])
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('Handling merge conflicts when our version is missing or incomplete', () => {
    it('should generate conflict markers when an empty local version conflicts with modified field permissions in remote', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {},
      }

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            { '#text': SALESFORCE_EOL },
            { '#text': '||||||| base' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '=======' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should generate conflict markers when an empty local version conflicts with significant structure changes in remote', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          description: 'Their description',
        },
      }

      const local = {}

      const other: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
        { '#text': SALESFORCE_EOL },
        { '#text': '||||||| base' },
        {
          Profile: [
            { description: [{ '#text': 'Their description' }] },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Industry' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
        { '#text': '=======' },
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Type' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
          ],
        },
        { '#text': '>>>>>>> theirs' },
      ])
      expect(result.hasConflict).toBe(true)
    })
  })

  it('should remove fields from result when they exist in ancestor but are removed in both local and other', () => {
    // Arrange
    const ancestor: JsonValue = {
      Profile: {
        fieldPermissions: [
          { field: 'Account.Name', editable: 'true', readable: 'true' },
        ],
      },
    }

    const local: JsonValue = {
      Profile: {},
    }

    const other: JsonValue = {
      Profile: {},
    }

    // Act
    const result = sut.mergeThreeWay(ancestor, local, other)

    // Assert
    expect(result.output).toEqual([
      {
        Profile: [],
      },
    ])
    expect(result.hasConflict).toBe(false)
  })

  it('should give empty result when they exist in ancestor not local and other', () => {
    // Arrange
    const ancestor: JsonValue = {
      Profile: {
        fieldPermissions: [
          { field: 'Account.Name', editable: 'true', readable: 'true' },
        ],
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      },
    }

    const local: JsonValue = {}

    const other: JsonValue = {}

    // Act
    const result = sut.mergeThreeWay(ancestor, local, other)

    // Assert
    expect(result.output).toEqual([])
    expect(result.hasConflict).toBe(false)
  })

  describe('String property merging scenarios', () => {
    it('should preserve string values when identical across all versions', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const local: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Original description' }],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should accept identical new string properties added in both local and other', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Our description' }],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should remove string properties deleted in both local and other', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const local: JsonValue = {
        Profile: {},
      }

      const other: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should prioritize local deletion when local deletes a property but other keeps it unchanged', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const local: JsonValue = {
        Profile: {},
      }

      const other: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should prioritize remote deletion when other deletes a property but local keeps it unchanged', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should accept identical new properties when ancestor lacks the parent structure entirely', () => {
      // Arrange
      const ancestor: JsonValue = {}

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Our description' }],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should mark conflict when both sides add different values for the same new property', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| base' },
            { '#text': SALESFORCE_EOL },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should mark conflict when local deletes a property but other modifies it', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const local: JsonValue = {
        Profile: {},
      }

      const other: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            { '#text': SALESFORCE_EOL },
            { '#text': '||||||| base' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should mark conflict when local modifies a property but other deletes it', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| base' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            { '#text': SALESFORCE_EOL },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should mark conflict when both sides modify the same property with different values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const local: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const other: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| base' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('Array merging in metadata with special position handling', () => {
    it('should successfully merge arrays when local and remote changes affect different elements', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
            { thursdayStart: 300, thursdayEnd: 400 },
            { fridayStart: 300, fridayEnd: 400 },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 200, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
            { thursdayStart: 300, thursdayEnd: 400 },
            { fridayStart: 300, fridayEnd: 400 },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 500 },
            { thursdayStart: 300, thursdayEnd: 400 },
            { fridayStart: 300, fridayEnd: 400 },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              loginHours: [
                { fridayEnd: [{ '#text': 400 }] },
                { fridayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { mondayEnd: [{ '#text': 400 }] },
                { mondayStart: [{ '#text': 200 }] },
              ],
            },
            {
              loginHours: [
                { thursdayEnd: [{ '#text': 400 }] },
                { thursdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { tuesdayEnd: [{ '#text': 400 }] },
                { tuesdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { wednesdayEnd: [{ '#text': 500 }] },
                { wednesdayStart: [{ '#text': 300 }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should adopt remote changes when an element is modified only in the remote version', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginIpRanges: [
            {
              startAddress: '192.168.1.1',
              endAddress: '10.0.0.1',
              description: 'description',
            },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          loginIpRanges: [
            {
              startAddress: '192.168.1.1',
              endAddress: '10.0.0.1',
              description: 'description',
            },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          loginIpRanges: [
            {
              startAddress: '192.168.1.1',
              endAddress: '10.0.0.2',
              description: 'description',
            },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              loginIpRanges: [
                { description: [{ '#text': 'description' }] },
                { endAddress: [{ '#text': '10.0.0.2' }] },
                { startAddress: [{ '#text': '192.168.1.1' }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should incorporate new elements added in remote array when remote array is longer', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
            { thursdayStart: 300, thursdayEnd: 400 },
            { fridayStart: 300, fridayEnd: 400 },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              loginHours: [
                { fridayEnd: [{ '#text': 400 }] },
                { fridayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { mondayEnd: [{ '#text': 400 }] },
                { mondayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { thursdayEnd: [{ '#text': 400 }] },
                { thursdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { tuesdayEnd: [{ '#text': 400 }] },
                { tuesdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { wednesdayEnd: [{ '#text': 400 }] },
                { wednesdayStart: [{ '#text': 300 }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should preserve locally added elements while merging remote changes to existing elements', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
          ],
        },
      }

      const local: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 400 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
            { wednesdayStart: 300, wednesdayEnd: 400 },
            { thursdayStart: 300, thursdayEnd: 400 },
            { fridayStart: 300, fridayEnd: 400 },
          ],
        },
      }

      const other: JsonValue = {
        Profile: {
          loginHours: [
            { mondayStart: 300, mondayEnd: 500 },
            { tuesdayStart: 300, tuesdayEnd: 400 },
          ],
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Profile: [
            {
              loginHours: [
                { fridayEnd: [{ '#text': 400 }] },
                { fridayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { mondayEnd: [{ '#text': 500 }] },
                { mondayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { thursdayEnd: [{ '#text': 400 }] },
                { thursdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { tuesdayEnd: [{ '#text': 400 }] },
                { tuesdayStart: [{ '#text': 300 }] },
              ],
            },
            {
              loginHours: [
                { wednesdayEnd: [{ '#text': 400 }] },
                { wednesdayStart: [{ '#text': 300 }] },
              ],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('Package.xml version merging', () => {
    it('should generate conflict markers when both sides change version to different values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Package: {
          version: '59.0',
        },
      }

      const local: JsonValue = {
        Package: {
          version: '60.0',
        },
      }

      const other: JsonValue = {
        Package: {
          version: '61.0',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Package: [
            { '#text': SALESFORCE_EOL + '<<<<<<< ours' },
            {
              version: [{ '#text': '60.0' }],
            },
            { '#text': '||||||| base' },
            {
              version: [{ '#text': '59.0' }],
            },
            { '#text': '=======' },
            {
              version: [{ '#text': '61.0' }],
            },
            { '#text': '>>>>>>> theirs' },
          ],
        },
      ])
      expect(result.hasConflict).toBe(true)
    })

    it('should use the changed version when only one side changes it', () => {
      // Arrange
      const ancestor: JsonValue = {
        Package: {
          version: '59.0',
        },
      }

      const local: JsonValue = {
        Package: {
          version: '59.0',
        },
      }

      const other: JsonValue = {
        Package: {
          version: '60.0',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Package: [
            {
              version: [{ '#text': '60.0' }],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })

    it('should preserve version when both sides have the same version', () => {
      // Arrange
      const ancestor: JsonValue = {
        Package: {
          version: '59.0',
        },
      }

      const local: JsonValue = {
        Package: {
          version: '60.0',
        },
      }

      const other: JsonValue = {
        Package: {
          version: '60.0',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.output).toEqual([
        {
          Package: [
            {
              version: [{ '#text': '60.0' }],
            },
          ],
        },
      ])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('Package.xml members merging', () => {
    it('should merge members from both sides when adding different members to same type', () => {
      // Arrange - simulates the scenario from the issue
      const ancestor: JsonValue = {
        Package: {
          types: [
            { members: 'ServiceClass', name: 'ApexTrigger' },
            { members: 'AccountTrigger', name: 'ApexClass' },
          ],
          version: '63.0',
        },
      }

      const local: JsonValue = {
        Package: {
          types: [
            {
              members: ['ServiceClass', 'SelectorClass'],
              name: 'ApexTrigger',
            },
            {
              members: ['AccountTrigger', 'OpportunityTrigger'],
              name: 'ApexClass',
            },
            { members: 'AccountPage', name: 'ApexPage' },
          ],
          version: '64.0',
        },
      }

      const other: JsonValue = {
        Package: {
          types: [
            {
              members: ['ServiceClass', 'ServiceClass2'],
              name: 'ApexTrigger',
            },
            {
              members: ['AccountTrigger', 'OpportunityTrigger'],
              name: 'ApexClass',
            },
          ],
          version: '65.0',
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert - ApexClass should have merged members without conflict
      // ApexTrigger should have ServiceClass, SelectorClass (from local), and ServiceClass2 (from other)
      // ApexPage should be included (added in local only)
      // Version should have a conflict (64.0 vs 65.0)
      expect(result.hasConflict).toBe(true) // Only because of version conflict

      // Verify the structure contains the expected types
      const packageContent = result.output[0] as { Package: JsonValue[] }
      expect(packageContent).toHaveProperty('Package')

      // Find the types in the output
      const types = (packageContent.Package as JsonValue[]).filter(
        (item: JsonValue) =>
          typeof item === 'object' && item !== null && 'types' in item
      )

      // Should have ApexClass, ApexPage, and ApexTrigger types
      expect(types.length).toBeGreaterThanOrEqual(3)
    })

    it('should merge members arrays correctly when both sides add different members', () => {
      // Arrange - simplified case focusing on members array merging
      const ancestor: JsonValue = {
        Package: {
          types: { members: 'ServiceClass', name: 'ApexTrigger' },
        },
      }

      const local: JsonValue = {
        Package: {
          types: {
            members: ['ServiceClass', 'SelectorClass'],
            name: 'ApexTrigger',
          },
        },
      }

      const other: JsonValue = {
        Package: {
          types: {
            members: ['ServiceClass', 'ServiceClass2'],
            name: 'ApexTrigger',
          },
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert - should include all three members: ServiceClass, SelectorClass, ServiceClass2
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        {
          Package: [
            {
              types: [
                { members: [{ '#text': 'SelectorClass' }] },
                { members: [{ '#text': 'ServiceClass' }] },
                { members: [{ '#text': 'ServiceClass2' }] },
                { name: [{ '#text': 'ApexTrigger' }] },
              ],
            },
          ],
        },
      ])
    })

    it('should handle member deletion correctly when removed in one branch', () => {
      // Arrange
      const ancestor: JsonValue = {
        Package: {
          types: {
            members: ['ServiceClass', 'OldClass'],
            name: 'ApexTrigger',
          },
        },
      }

      const local: JsonValue = {
        Package: {
          types: {
            members: ['ServiceClass', 'OldClass', 'NewLocalClass'],
            name: 'ApexTrigger',
          },
        },
      }

      const other: JsonValue = {
        Package: {
          types: {
            // OldClass removed, ServiceClass kept
            members: 'ServiceClass',
            name: 'ApexTrigger',
          },
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert - OldClass should be removed (deleted in other), NewLocalClass should be added
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        {
          Package: [
            {
              types: [
                { members: [{ '#text': 'NewLocalClass' }] },
                { members: [{ '#text': 'ServiceClass' }] },
                { name: [{ '#text': 'ApexTrigger' }] },
              ],
            },
          ],
        },
      ])
    })

    it('should handle single member to array member conversion', () => {
      // Arrange
      const ancestor: JsonValue = {
        Package: {
          types: { members: 'OnlyMember', name: 'ApexClass' },
        },
      }

      const local: JsonValue = {
        Package: {
          types: {
            members: ['OnlyMember', 'LocalMember'],
            name: 'ApexClass',
          },
        },
      }

      const other: JsonValue = {
        Package: {
          types: {
            members: ['OnlyMember', 'RemoteMember'],
            name: 'ApexClass',
          },
        },
      }

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert - should have all three members
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([
        {
          Package: [
            {
              types: [
                { members: [{ '#text': 'LocalMember' }] },
                { members: [{ '#text': 'OnlyMember' }] },
                { members: [{ '#text': 'RemoteMember' }] },
                { name: [{ '#text': 'ApexClass' }] },
              ],
            },
          ],
        },
      ])
    })
  })
})
