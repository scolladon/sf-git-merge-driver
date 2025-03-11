import { JsonMerger, JsonValue } from '../../../src/merger/JsonMerger.js'

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

    // TODO : Testing Conflict outputs
    // still not sure if we should test conflict for primitives as it lacks a unique identifier
    //    maybe only throwing an error to treat the conflict at the parent node level
    // (1,null,2) should output conflict with tags and each value with git conflict convention
    // same for (1,2,null)
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

    // TODO: Testing Conflict outputs
    // { a: 1, b: 2 }{ a: 1, b: 3, c: 4 }{ a: 1, b: 6, d: 5 } should merge all but output conflict on b
    // standard is <<<<<<< ours\n {ours version here} \n ||||||| base\n {base version here} \n =======\n {theirs version here} \n >>>>>>> theirs
    // if base null or empty (node does not exist in base) we can put it as empty or remove the entire base part
    // (I prefer always putting the 3 parts to make it clearer)

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

    // TODO: this one should output a conflict as the types are not compatible
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

    // TODO: this one should output a conflict as there are 2 different diversions
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

    // TODO: I don't know if we should have such case ever
    // if we actually do, I'd think the output should be [3,4,5]
    // because ours removes 1 and adds 4 and theirs removes 1 & 2 and adds 4 & 5 which are compatible
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
        const ancestor: JsonValue = {
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 100 },
            { fullName: 'Field2__c', type: 'Number', precision: 10 },
          ],
        }
        const ours: JsonValue = {
          fields: [
            { fullName: 'Field1__c', type: 'Text', length: 255 },
            { fullName: 'Field2__c', type: 'Number', precision: 10 },
          ],
        }
        const theirs: JsonValue = {
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

    // TODO: check but we shoud apply each change here as they are compatible
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

    // TODO: Adding the different cases where the unique key is not the usual ones (those few types which have composite keys)

    // TODO: Adding cases for the few for which the order of items in a list is important, like picklist values in a CustomField

    // TODO: Adding conflict cases for Object element conflict

    // TODO: Adding conflict cases for List element conflict
  })
})
