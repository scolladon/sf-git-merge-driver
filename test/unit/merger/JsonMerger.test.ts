import { JsonMerger } from '../../../src/merger/JsonMerger.js'

describe('JsonMerger', () => {
  let sut: JsonMerger

  beforeEach(() => {
    // Arrange
    sut = new JsonMerger()
  })

  describe('given primitive values', () => {
    describe('when our changes differ from ancestor', () => {
      it('then should prefer our changes', () => {
        // Act & Assert
        expect(sut.mergeObjects(1, 2, 1)).toBe(2)
        expect(sut.mergeObjects('old', 'new', 'old')).toBe('new')
        expect(sut.mergeObjects(true, false, true)).toBe(false)
      })
    })

    describe('when we match ancestor', () => {
      it('then should accept their changes', () => {
        // Act & Assert
        expect(sut.mergeObjects(1, 1, 2)).toBe(2)
        expect(sut.mergeObjects('old', 'old', 'new')).toBe('new')
        expect(sut.mergeObjects(true, true, false)).toBe(false)
      })
    })

    describe('when null values are present', () => {
      it('then should handle them correctly', () => {
        // Act & Assert
        expect(sut.mergeObjects(1, null, null)).toBeNull()
        expect(sut.mergeObjects(null, 1, null)).toBe(1)
        expect(sut.mergeObjects(undefined, null, 1)).toBe(1)
      })
    })
  })

  describe('given objects to merge', () => {
    describe('when changes are non-conflicting', () => {
      it('then should merge them correctly', () => {
        // Arrange
        const ancestor = { a: 1, b: 2 }
        const ours = { a: 1, b: 3, c: 4 }
        const theirs = { a: 1, b: 2, d: 5 }

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual({
          a: 1,
          b: 3,
          c: 4,
          d: 5,
        })
      })
    })

    describe('when objects are nested', () => {
      it('then should handle nested structures', () => {
        // Arrange
        const ancestor = { nested: { a: 1, b: 2 } }
        const ours = { nested: { a: 2, b: 2 } }
        const theirs = { nested: { a: 1, b: 3 } }

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual({
          nested: { a: 2, b: 3 },
        })
      })
    })

    describe('when type mismatches occur', () => {
      it('then should prefer our version', () => {
        // Arrange
        const ancestor = { a: 1 }
        const ours = { a: { nested: true } }
        const theirs = { a: 2 }

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual({
          a: { nested: true },
        })
      })
    })
  })

  describe('given arrays to merge', () => {
    describe('when arrays have common identifiers', () => {
      it('then should merge them correctly', () => {
        // Arrange
        const ancestor = [
          { fullName: 'test1', value: 1 },
          { fullName: 'test2', value: 2 },
        ]
        const ours = [
          { fullName: 'test1', value: 3 },
          { fullName: 'test2', value: 2 },
        ]
        const theirs = [
          { fullName: 'test1', value: 1 },
          { fullName: 'test2', value: 4 },
          { fullName: 'test3', value: 5 },
        ]

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual([
          { fullName: 'test1', value: 3 },
          { fullName: 'test2', value: 4 },
          { fullName: 'test3', value: 5 },
        ])
      })
    })

    describe('when arrays use different identifier fields', () => {
      it('then should handle different identifiers', () => {
        // Arrange
        const ancestor = [{ name: 'test1', value: 1 }]
        const ours = [{ name: 'test1', value: 2 }]
        const theirs = [{ name: 'test1', value: 3 }]

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual([
          { name: 'test1', value: 2 },
        ])
      })
    })

    describe('when arrays have no identifiers', () => {
      it('then should use our version', () => {
        // Arrange
        const ancestor = [1, 2, 3]
        const ours = [2, 3, 4]
        const theirs = [3, 4, 5]

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual([2, 3, 4])
      })
    })
  })

  describe('given Salesforce metadata', () => {
    describe('when merging custom field definitions', () => {
      it('then should merge correctly', () => {
        // Arrange
        const ancestor = {
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 100 },
            { fullName: 'Field2__c', type: 'Number', precision: 10 },
          ],
        }
        const ours = {
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 255 },
            { fullName: 'Field2__c', type: 'Number', precision: 10 },
          ],
        }
        const theirs = {
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 100 },
            { fullName: 'Field2__c', type: 'Number', precision: 18 },
            { fullName: 'Field3__c', type: 'Checkbox' },
          ],
        }

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual({
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 255 },
            { fullName: 'Field2__c', type: 'Number', precision: 18 },
            { fullName: 'Field3__c', type: 'Checkbox' },
          ],
        })
      })
    })

    describe('when merging layout metadata', () => {
      it('then should merge layouts correctly', () => {
        // Arrange
        const ancestor = {
          layoutSections: [
            { label: 'Information', layoutColumns: [{ fields: ['Name'] }] },
          ],
        }
        const ours = {
          layoutSections: [
            {
              label: 'Information',
              layoutColumns: [{ fields: ['Name', 'Email'] }],
            },
          ],
        }
        const theirs = {
          layoutSections: [
            {
              label: 'Information',
              layoutColumns: [{ fields: ['Name', 'Phone'] }],
            },
            { label: 'System', layoutColumns: [{ fields: ['CreatedDate'] }] },
          ],
        }

        // Act & Assert
        expect(sut.mergeObjects(ancestor, ours, theirs)).toEqual({
          layoutSections: [
            {
              label: 'Information',
              layoutColumns: [{ fields: ['Name', 'Email'] }],
            },
            { label: 'System', layoutColumns: [{ fields: ['CreatedDate'] }] },
          ],
        })
      })
    })
  })
})
