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
      expect(result).toEqual({
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'false' },
            { field: 'Account.Industry', editable: 'false', readable: 'true' },
          ],
        },
      })
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
      expect(result).toEqual({
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
          ],
        },
      })
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
      expect(result).toEqual({
        Profile: {
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
        },
      })
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
      expect(result).toEqual({
        Profile: {
          custom: ['Value1', 'Value3', 'Value2', 'Value4'],
        },
      })
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
      expect(result).toEqual({
        Profile: {
          values: [1, 4, 5, 2, 6],
        },
      })
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
      expect(result).toEqual({
        Profile: {
          description: ['Our updated description', 'Original description'],
          fieldPermissions: [
            { field: 'Account.Name', editable: 'true', readable: 'true' },
            { field: 'Account.Type', editable: 'false', readable: 'true' },
          ],
          custom: ['Value1', 'Value3', 'Value2', 'Value4'],
          label: ['Their Label'],
        },
      })
    })
  })

  describe('given type conflicts', () => {
    it('should prefer our changes when types conflict', () => {
      // Arrange
      const ancestor: JsonValue = {
        settings: { enabled: 'false' },
      }

      const ours: JsonValue = {
        settings: ['option1', 'option2'],
      }

      const theirs: JsonValue = {
        settings: { enabled: 'true', newSetting: 'value' },
      }

      // Act
      const result = sut.mergeObjects(ancestor, ours, theirs)

      // Assert
      expect(result).toEqual({
        settings: {
          '0': 'option1',
          '1': 'option2',
          enabled: ['true'],
          newSetting: ['value'],
        },
      })
    })
  })
})
