import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../src/adapter/parser/CompactXmlParser.js'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

const parser = new CompactXmlParser()
const merger = new XmlMerger(defaultConfig)
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

describe('repeated keyed elements carrying XML attributes', () => {
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
    'preserves valid XML when %s',
    async (_name, ancestor, ours, theirs, expected) => {
      const result = await mergeXmlStrings(
        merger,
        doc(ancestor + siblings),
        doc(ours + siblings),
        doc(theirs + siblings)
      )

      expect(result.hasConflict).toBe(false)
      expect(result.output).not.toContain('<@_')
      expect(parser.parseString(result.output)).toEqual(
        parser.parseString(doc(expected + siblings))
      )
    }
  )

  it('keeps attributes on an unchanged entry while merging an edited sibling', async () => {
    const result = await mergeXmlStrings(
      merger,
      doc(base + siblings),
      doc(base + siblings.replace('<readable>false', '<readable>true')),
      doc(base + siblings)
    )

    expect(result.hasConflict).toBe(false)
    expect(parser.parseString(result.output)).toEqual(
      parser.parseString(
        doc(base + siblings.replace('<readable>false', '<readable>true'))
      )
    )
  })

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
    'preserves complete elements in conflict sides when %s',
    async (_name, ancestor, ours, theirs) => {
      const result = await mergeXmlStrings(
        merger,
        doc(ancestor + siblings),
        doc(ours + siblings),
        doc(theirs + siblings)
      )

      expect(result.hasConflict).toBe(true)
      expect(result.output).not.toContain('<@_')
      const conflict = result.output.match(
        /<<<<<<< ours\n([\s\S]*?)\|\|\|\|\|\|\| base\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs/
      )
      expect(conflict).not.toBeNull()
      for (const [index, side] of [ours, ancestor, theirs].entries()) {
        expect(parser.parseString(doc(conflict![index + 1]!))).toEqual(
          parser.parseString(doc(side))
        )
      }
      // The other keyed entries must survive outside the conflicting entry.
      expect(result.output).toContain('<field>Account.Y__c</field>')
      expect(result.output).toContain('<field>Account.Z__c</field>')
    }
  )
})
