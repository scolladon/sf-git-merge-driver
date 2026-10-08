import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../src/adapter/parser/CompactXmlParser.js'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

const parser = new CompactXmlParser()
const doc = (body: string): string =>
  `<Profile xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:n1="http://www.w3.org/2001/XMLSchema-instance">${body}</Profile>`
const entry = (
  readable = 'false',
  editable = 'false',
  attributes = ' n1:nil="false"'
): string =>
  `<fieldPermissions${attributes}><field>Account.X__c</field><readable>${readable}</readable><editable>${editable}</editable></fieldPermissions>`
// Two unchanged entries keep every side on the array route, even when the
// target entry is absent. An attributed singleton takes a different route.
const siblings =
  '<fieldPermissions><field>Account.Y__c</field><readable>false</readable></fieldPermissions>' +
  '<fieldPermissions><field>Account.Z__c</field><readable>false</readable></fieldPermissions>'
const base = entry()
const changed = entry('true')
const plain = entry('false', 'false', '')
const plainChanged = entry('true', 'false', '')
const CONFLICT_SIDES =
  /<<<<<<< ours\n([\s\S]*?)\|\|\|\|\|\|\| base\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs/

describe('given repeated keyed elements carrying XML attributes', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('when the sides make compatible changes', () => {
    it.each([
      ['all unchanged', base, base, base, base],
      ['only ours changes a child', base, changed, base, changed],
      ['only theirs changes a child', base, base, changed, changed],
      ['both make the same change', base, changed, changed, changed],
      ['ours adds the attribute', plain, base, plain, base],
      ['theirs adds the attribute', plain, plain, base, base],
      ['ours removes the attribute', base, plain, base, plain],
      ['theirs removes the attribute', base, base, plain, plain],
      ['ours adds the element', '', base, '', base],
      ['theirs adds the element', '', '', base, base],
      ['both add the same element', '', base, base, base],
      ['ours deletes the element', base, '', base, ''],
      ['theirs deletes the element', base, base, '', ''],
      ['both delete the element', base, '', '', ''],
    ])(
      'then it preserves valid XML when %s',
      async (_name, ancestor, ours, theirs, expected) => {
        // Arrange
        const ancestorXml = doc(ancestor + siblings)
        const oursXml = doc(ours + siblings)
        const theirsXml = doc(theirs + siblings)

        // Act
        const result = await mergeXmlStrings(
          sut,
          ancestorXml,
          oursXml,
          theirsXml
        )

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).not.toContain('<@_')
        expect(parser.parseString(result.output)).toEqual(
          parser.parseString(doc(expected + siblings))
        )
      }
    )
  })

  describe('when only a sibling entry is edited', () => {
    it('then the unchanged entry keeps its attributes', async () => {
      // Arrange
      const editedSiblings = siblings.replace(
        '<readable>false',
        '<readable>true'
      )

      // Act
      const result = await mergeXmlStrings(
        sut,
        doc(base + siblings),
        doc(base + editedSiblings),
        doc(base + siblings)
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(parser.parseString(result.output)).toEqual(
        parser.parseString(doc(base + editedSiblings))
      )
    })
  })

  describe('when the sides make incompatible changes', () => {
    it.each([
      ['both edit different children', base, changed, entry('false', 'true')],
      ['ours deletes and theirs edits', base, '', changed],
      ['theirs deletes and ours edits', base, changed, ''],
      ['both add different elements', '', base, changed],
      ['ours adds an attribute while theirs edits', plain, base, plainChanged],
      ['theirs adds an attribute while ours edits', plain, plainChanged, base],
      [
        'both remove the attribute and edit differently',
        base,
        plainChanged,
        entry('false', 'true', ''),
      ],
    ])(
      'then the conflict sides hold complete elements when %s',
      async (_name, ancestor, ours, theirs) => {
        // Arrange
        const ancestorXml = doc(ancestor + siblings)
        const oursXml = doc(ours + siblings)
        const theirsXml = doc(theirs + siblings)

        // Act
        const result = await mergeXmlStrings(
          sut,
          ancestorXml,
          oursXml,
          theirsXml
        )

        // Assert
        expect(result.hasConflict).toBe(true)
        expect(result.output).not.toContain('<@_')
        const conflict = result.output.match(CONFLICT_SIDES)
        if (!conflict) throw new Error('expected conflict markers')
        const [, oursBlock, baseBlock, theirsBlock] = conflict
        expect(parser.parseString(doc(oursBlock))).toEqual(
          parser.parseString(doc(ours))
        )
        expect(parser.parseString(doc(baseBlock))).toEqual(
          parser.parseString(doc(ancestor))
        )
        expect(parser.parseString(doc(theirsBlock))).toEqual(
          parser.parseString(doc(theirs))
        )
        // The other keyed entries survive outside the conflicting entry.
        expect(result.output).toContain('<field>Account.Y__c</field>')
        expect(result.output).toContain('<field>Account.Z__c</field>')
      }
    )
  })
})
