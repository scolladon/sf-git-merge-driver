import { JsonMerger, JsonValue } from '../../../src/merger/JsonMerger.js'

describe('JsonMerger', () => {
  let sut: JsonMerger

  beforeEach(() => {
    // Arrange
    sut = new JsonMerger()
  })

  describe('given arrays with key fields', () => {
    it('should merge arrays using the key field to identify matching elements', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Industry' }] },
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
    })

    it('should handle the scenario when both sides modify the same element', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
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
    })

    it('should handle the scenario when we modify an element and they add a new one', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
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
    })
  })

  describe('given arrays without key fields', () => {
    it('should merge arrays without duplicates', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          custom: ['Value1', 'Value2'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          custom: ['Value1', 'Value3'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          custom: ['Value1', 'Value2', 'Value4'],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              custom: ['Value1', 'Value3', 'Value2', 'Value4'],
            },
          ],
        },
      ])
    })

    it('should handle primitive values in arrays', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          values: [1, 2, 3],
        },
      }

      const ours: JsonValue = {
        Profile: {
          values: [1, 4, 5],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          values: [1, 2, 6],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              values: [1, 4, 5, 2, 6],
            },
          ],
        },
      ])
    })
  })

  describe('given mixed JSON with both key and non-key arrays', () => {
    it('should correctly merge a complex structure with both types', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
          custom: ['Value1', 'Value2'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our updated description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
          custom: ['Value1', 'Value3'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Original description',
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          custom: ['Value2', 'Value4'],
          label: 'Their Label',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { custom: ['Value1', 'Value3', 'Value2', 'Value4'] },
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
    })
  })

  describe('test dealing with namespace', () => {
    it('it should come at the right level', () => {
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

      const ours: JsonValue = {
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

      const theirs: JsonValue = {
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
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
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
    })
  })

  describe('given undefined ancestor', () => {
    it('should correctly merge objects when ancestor is undefined', () => {
      // Arrange
      const ancestor = {}

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          custom: ['Value1', 'Value3'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          custom: ['Value2', 'Value4'],
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        { '#text': '\n<<<<<<< LOCAL' },
        {
          Profile: [
            { custom: ['Value1', 'Value3'] },
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
        { '#text': '\n' },
        { '#text': '=======' },
        {
          Profile: [
            { custom: ['Value2', 'Value4'] },
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
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
          ],
        },
        { '#text': '>>>>>>> REMOTE' },
      ])
    })

    it('should correctly merge objects when ancestor key undefined', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              fieldPermissions: [
                { '#text': '\n<<<<<<< LOCAL' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': '\n' },
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
    })
  })

  describe('given undefined their', () => {
    it('should correctly merge objects', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
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
            { '#text': '\n' },
            { '#text': '>>>>>>> REMOTE' },
          ],
        },
      ])
    })

    it('should correctly merge objects when theirs is undefined', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          custom: ['Value2', 'Value4'],
          description: 'Their description',
        },
      }

      const ours: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          custom: ['Value1', 'Value3'],
        },
      }

      const theirs = {}

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        { '#text': '\n<<<<<<< LOCAL' },
        {
          Profile: [
            { custom: ['Value1', 'Value3'] },
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
            { custom: ['Value2', 'Value4'] },
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
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
          ],
        },
        { '#text': '=======' },
        { '#text': '\n' },
        { '#text': '>>>>>>> REMOTE' },
      ])
    })
  })

  describe('given undefined our', () => {
    it('should correctly merge objects', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      }

      const ours: JsonValue = {
        Profile: {},
      }

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'true' },
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
            { '#text': '\n' },
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
    })

    it('should correctly merge objects', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
          custom: ['Value2', 'Value4'],
          description: 'Their description',
        },
      }

      const ours = {}

      const theirs: JsonValue = {
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          custom: ['Value1', 'Value3'],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        { '#text': '\n<<<<<<< LOCAL' },
        { '#text': '\n' },
        { '#text': '||||||| BASE' },
        {
          Profile: [
            { custom: ['Value2', 'Value4'] },
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
                { editable: [{ '#text': 'false' }] },
                { field: [{ '#text': 'Account.Name' }] },
                { readable: [{ '#text': 'false' }] },
              ],
            },
          ],
        },
        { '#text': '=======' },
        {
          Profile: [
            { custom: ['Value1', 'Value3'] },
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
    })
  })

  it('only ancestor key present should just be removed', () => {
    // Arrange
    const ancestor: JsonValue = {
      Profile: {
        fieldPermissions: [
          { field: 'Account.Name', editable: 'true', readable: 'true' },
        ],
      },
    }

    const ours: JsonValue = {
      Profile: {},
    }

    const theirs: JsonValue = {
      Profile: {},
    }

    // Act
    const result = sut.mergeObjects(ancestor, ours, theirs)

    // Assert
    expect(result).toEqual([
      {
        Profile: [],
      },
    ])
  })

  describe('Nominal case', () => {
    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Original description' }],
            },
          ],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Our description' }],
            },
          ],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const ours: JsonValue = {
        Profile: {},
      }

      const theirs: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const ours: JsonValue = {
        Profile: {},
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {}

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              description: [{ '#text': 'Our description' }],
            },
          ],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {},
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| BASE' },
            { '#text': '\n' },
            { '#text': '=======' },
            {
              description: [{ '#text': 'Their description' }],
            },
            { '#text': '>>>>>>> REMOTE' },
          ],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const ours: JsonValue = {
        Profile: {},
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
            { '#text': '\n' },
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
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {},
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
            {
              description: [{ '#text': 'Our description' }],
            },
            { '#text': '||||||| BASE' },
            {
              description: [{ '#text': 'Original description' }],
            },
            { '#text': '=======' },
            { '#text': '\n' },
            { '#text': '>>>>>>> REMOTE' },
          ],
        },
      ])
    })

    it('should handle string values', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          description: 'Original description',
        },
      }

      const ours: JsonValue = {
        Profile: {
          description: 'Our description',
        },
      }

      const theirs: JsonValue = {
        Profile: {
          description: 'Their description',
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            { '#text': '\n<<<<<<< LOCAL' },
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
    })
  })

  describe('given arrays with <array> key field', () => {
    it('should merge arrays by position when both sides modify different elements', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          loginHours: [
            'Monday-Modified',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
          ],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          loginHours: [
            'Monday',
            'Tuesday',
            'Wednesday-Modified',
            'Thursday',
            'Friday',
          ],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              loginHours: [
                'Monday-Modified',
                'Tuesday',
                'Wednesday-Modified',
                'Thursday',
                'Friday',
              ],
            },
          ],
        },
      ])
    })

    it('should use their version when we did not modify an element but they did', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginIpRanges: ['192.168.1.1', '10.0.0.1', '172.16.0.1'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          loginIpRanges: ['192.168.1.1', '10.0.0.1', '172.16.0.1'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          loginIpRanges: ['192.168.1.1', '10.0.0.2', '172.16.0.1'],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              loginIpRanges: ['192.168.1.1', '10.0.0.2', '172.16.0.1'],
            },
          ],
        },
      ])
    })

    it('should append their additional elements when their array is longer', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday', 'Wednesday'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday', 'Wednesday'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              loginHours: [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
              ],
            },
          ],
        },
      ])
    })

    it('should keep our additional elements when our array is longer', () => {
      // Arrange
      const ancestor: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday'],
        },
      }

      const ours: JsonValue = {
        Profile: {
          loginHours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }

      const theirs: JsonValue = {
        Profile: {
          loginHours: ['Monday-Modified', 'Tuesday'],
        },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual([
        {
          Profile: [
            {
              loginHours: [
                'Monday-Modified',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
              ],
            },
          ],
        },
      ])
    })
  })
})
