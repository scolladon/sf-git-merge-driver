import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../src/adapter/parser/CompactXmlParser.js'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

const parser = new CompactXmlParser()
const ROOT_ATTRIBUTES =
  'xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
const doc = (values: string, label = 'Rec', isProtected = 'false'): string =>
  `<CustomMetadata ${ROOT_ATTRIBUTES}><label>${label}</label><protected>${isProtected}</protected>${values}</CustomMetadata>`
const typed = (field: string, type: string, value: string): string =>
  `<values><field>${field}</field><value xsi:type="xsd:${type}">${value}</value></values>`
const str = (field: string, value: string): string =>
  typed(field, 'string', value)
const nil = (field: string): string =>
  `<values><field>${field}</field><value xsi:nil="true"/></values>`
const plain = (field: string, value: string): string =>
  `<values><field>${field}</field><value>${value}</value></values>`
const noValue = (field: string): string =>
  `<values><field>${field}</field></values>`
const CONFLICT_SIDES =
  /<<<<<<< ours\n([\s\S]*?)\|\|\|\|\|\|\| base\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs/

const base = str('A__c', 'a') + str('B__c', 'b') + nil('C__c')

describe('given a CustomMetadata record with values entries', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('when the sides make compatible changes', () => {
    it.each([
      [
        'each side edits a different entry',
        doc(base),
        doc(str('A__c', 'a2') + str('B__c', 'b') + nil('C__c')),
        doc(str('A__c', 'a') + str('B__c', 'b2') + nil('C__c')),
        doc(str('A__c', 'a2') + str('B__c', 'b2') + nil('C__c')),
      ],
      [
        'each side adds a different entry',
        doc(base),
        doc(base + typed('E__c', 'double', '1.5')),
        doc(base + typed('D__c', 'boolean', 'true')),
        doc(
          base +
            typed('D__c', 'boolean', 'true') +
            typed('E__c', 'double', '1.5')
        ),
      ],
      [
        'each side edits a different entry whose value carries no type',
        doc(plain('P__c', 'p') + plain('Q__c', 'q')),
        doc(plain('P__c', 'p2') + plain('Q__c', 'q')),
        doc(plain('P__c', 'p') + plain('Q__c', 'q2')),
        doc(plain('P__c', 'p2') + plain('Q__c', 'q2')),
      ],
      [
        'ours edits the label and values are untouched',
        doc(base),
        doc(base, 'Renamed'),
        doc(base),
        doc(base, 'Renamed'),
      ],
      [
        'a field is repeated and ours edits the label',
        doc(str('A__c', 'a') + str('A__c', 'a2')),
        doc(str('A__c', 'a') + str('A__c', 'a2'), 'Renamed'),
        doc(str('A__c', 'a') + str('A__c', 'a2')),
        doc(str('A__c', 'a2'), 'Renamed'),
      ],
      [
        'the only entry is nilled by ours and theirs edits another element',
        doc(str('A__c', 'a')),
        doc(nil('A__c')),
        doc(str('A__c', 'a'), 'Rec', 'true'),
        doc(nil('A__c'), 'Rec', 'true'),
      ],
      [
        'ours gives a value to an entry that had none',
        doc(noValue('A__c')),
        doc(str('A__c', 'a')),
        doc(noValue('A__c')),
        doc(str('A__c', 'a')),
      ],
    ])(
      'then it merges cleanly when %s',
      async (_name, ancestor, ours, theirs, expected) => {
        // Act
        const result = await mergeXmlStrings(sut, ancestor, ours, theirs)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).not.toContain('<@_')
        expect(parser.parseString(result.output)).toEqual(
          parser.parseString(expected)
        )
      }
    )
  })

  describe('when both sides edit the same value differently', () => {
    it('then the conflict holds only the value element on each side', async () => {
      // Arrange
      const ancestor = doc(base)
      const ours = doc(str('A__c', 'ours') + str('B__c', 'b') + nil('C__c'))
      const theirs = doc(str('A__c', 'theirs') + str('B__c', 'b') + nil('C__c'))

      // Act
      const result = await mergeXmlStrings(sut, ancestor, ours, theirs)

      // Assert
      const sides = result.output.match(CONFLICT_SIDES)?.slice(1, 4) ?? []
      expect(result.hasConflict).toBe(true)
      expect(sides).toHaveLength(3)
      for (const side of sides) {
        expect(side.match(/<value xsi:type="xsd:string">/g)).toHaveLength(1)
        expect(side).not.toMatch(/<values>|<field>/)
      }
    })
  })
})

describe('given a RecordType with values entries keyed by fullName', () => {
  describe('when ours reorders them and theirs edits a sibling', () => {
    it('then ours order is kept', async () => {
      // Arrange
      const sut = new XmlMerger(defaultConfig)
      const entry = (name: string): string =>
        `<values><fullName>${name}</fullName><default>false</default></values>`
      const recordType = (values: string, active: string): string =>
        `<RecordType xmlns="http://soap.sforce.com/2006/04/metadata"><active>${active}</active><picklistValues><picklist>Industry</picklist>${values}</picklistValues></RecordType>`
      const ancestor = recordType(
        entry('Agriculture') + entry('Banking'),
        'true'
      )
      const ours = recordType(entry('Banking') + entry('Agriculture'), 'true')
      const theirs = recordType(
        entry('Agriculture') + entry('Banking'),
        'false'
      )

      // Act
      const result = await mergeXmlStrings(sut, ancestor, ours, theirs)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(parser.parseString(result.output)).toEqual(
        parser.parseString(
          recordType(entry('Banking') + entry('Agriculture'), 'false')
        )
      )
    })
  })
})
