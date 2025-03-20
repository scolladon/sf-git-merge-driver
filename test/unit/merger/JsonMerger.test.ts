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

  // KGO: removed because should never happen
  // describe('given type conflicts', () => {
  //   it('should prefer our changes when types conflict', () => {
  //     // Arrange
  //     const ancestor: JsonValue = {
  //       settings: { enabled: 'false' },
  //     }

  //     const ours: JsonValue = {
  //       settings: ['option1', 'option2'],
  //     }

  //     const theirs: JsonValue = {
  //       settings: { enabled: 'true', newSetting: 'value' },
  //     }

  //     // Act
  //     const result = sut.mergeObjects(ancestor, ours, theirs)

  //     // Assert
  //     expect(result).toEqual({
  //       settings: {
  //         '0': 'option1',
  //         '1': 'option2',
  //         enabled: ['true'],
  //         newSetting: ['value'],
  //       },
  //     })
  //   })
  // })

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
        {
          Profile: [
            { custom: ['Value1', 'Value3', 'Value2', 'Value4'] },
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
                { '#text': '<<<<<<< LOCAL' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': '\n' },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> REMOTE' },
                { field: [{ '#text': 'Account.Name' }] },
                { '#text': '<<<<<<< LOCAL' },
                { readable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': '\n' },
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
    })

    it('should correctly merge arrays with key field when ancestor is undefined', () => {
      // Arrange
      const ancestor = {}

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
                { '#text': '<<<<<<< LOCAL' },
                { editable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': '\n' },
                { '#text': '=======' },
                { editable: [{ '#text': 'false' }] },
                { '#text': '>>>>>>> REMOTE' },
                { field: [{ '#text': 'Account.Name' }] },
                { '#text': '<<<<<<< LOCAL' },
                { readable: [{ '#text': 'true' }] },
                { '#text': '||||||| BASE' },
                { '#text': '\n' },
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
    })

    it('should correctly merge arrays without key field when ancestor is undefined', () => {
      // Arrange
      const ancestor = {}

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
