import { SALESFORCE_EOL } from '../../../src/constant/metadataConstant.js'
import { ConflictMarker } from '../../../src/merger/conflictMarker.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { JsonValue } from '../../../src/types/jsonTypes.js'

describe('JsonMerger', () => {
  let sut: JsonMerger

  beforeEach(() => {
    // Arrange
    sut = new JsonMerger()
    ConflictMarker['hasConflict'] = false
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
                { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> REMOTE' },
                { field: [{ '#text': 'Account.Name' }] },
                { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
                { readable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { readable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> REMOTE' },
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
                { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': SALESFORCE_EOL },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            {
              unknown: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '||||||| BASE' },
            { '#text': SALESFORCE_EOL },
            { '#text': '=======' },
            {
              unknown: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '||||||| BASE' },
            {
              fieldPermissions: [
                { editable: [{ '#text': 'true' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'true' }] },
              ],
            },
            { '#text': '=======' },
            { '#text': SALESFORCE_EOL },
            { '#text': '>>>>>>> REMOTE' },
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
        { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
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
        { '#text': '||||||| BASE' },
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
        { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            { '#text': SALESFORCE_EOL },
            { '#text': '||||||| BASE' },
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
            { '#text': '>>>>>>> REMOTE' },
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
        { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
        { '#text': SALESFORCE_EOL },
        { '#text': '||||||| BASE' },
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
        { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| BASE' },
            { '#text': SALESFORCE_EOL },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            { '#text': SALESFORCE_EOL },
            { '#text': '||||||| BASE' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| BASE' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            { '#text': SALESFORCE_EOL },
            { '#text': '>>>>>>> REMOTE' },
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
            { '#text': SALESFORCE_EOL + '<<<<<<< LOCAL' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| BASE' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> REMOTE' },
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
})
