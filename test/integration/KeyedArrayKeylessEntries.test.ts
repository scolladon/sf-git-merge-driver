import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../src/adapter/parser/CompactXmlParser.js'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

const parser = new CompactXmlParser()
const doc = (body: string, custom = 'false'): string =>
  `<Profile xmlns="http://soap.sforce.com/2006/04/metadata">${body}<custom>${custom}</custom></Profile>`
const keyless = (editable = 'false', readable = 'false'): string =>
  `<fieldPermissions><editable>${editable}</editable><readable>${readable}</readable></fieldPermissions>`
const keyed = (editable: string): string =>
  `<fieldPermissions><editable>${editable}</editable><field>Account.X__c</field></fieldPermissions>`
const second = keyless('false', 'true')
const secondEdited = keyless('true', 'true')
const pair = keyless() + second
const CONFLICT_SIDES =
  /<<<<<<< ours\n([\s\S]*?)\|\|\|\|\|\|\| base\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs/
const OPEN_TAG = /<fieldPermissions>/g

const conflictSides = (output: string): string[] => {
  const conflict = output.match(CONFLICT_SIDES)
  if (!conflict) throw new Error('expected conflict markers')
  return conflict.slice(1, 4)
}
const countOpenTags = (side: string): number =>
  side.match(OPEN_TAG)?.length ?? 0

describe('given repeated entries without their key field', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('when the sides make compatible changes', () => {
    it.each([
      [
        'ours edits an unrelated sibling',
        doc(pair),
        doc(pair, 'true'),
        doc(pair),
        doc(pair, 'true'),
      ],
      [
        'ours edits one entry and theirs edits a sibling',
        doc(pair),
        doc(keyless('true') + second),
        doc(pair, 'true'),
        doc(keyless('true') + second, 'true'),
      ],
      [
        'both make the same edit',
        doc(pair),
        doc(keyless('true') + second),
        doc(keyless('true') + second),
        doc(keyless('true') + second),
      ],
      ['ours adds the pair', doc(''), doc(pair), doc(''), doc(pair)],
      [
        'each side edits the lone entry differently',
        doc(keyless()),
        doc(keyless('true')),
        doc(keyless('false', 'true')),
        doc(keyless('true', 'true')),
      ],
      [
        'an entry key is repeated',
        doc(keyed('false') + keyed('true')),
        doc(keyed('false') + keyed('true'), 'true'),
        doc(keyed('false') + keyed('true')),
        doc(keyed('true'), 'true'),
      ],
    ])(
      'then it preserves every entry when %s',
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

  describe('when each side edits a different entry', () => {
    it('then the conflict lists both entries on every side', async () => {
      // Arrange
      const ours = keyless('true') + second
      const theirs = keyless() + secondEdited

      // Act
      const result = await mergeXmlStrings(
        sut,
        doc(pair),
        doc(ours),
        doc(theirs)
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(conflictSides(result.output).map(countOpenTags)).toEqual([2, 2, 2])
    })
  })

  describe('when ours deletes the array and theirs edits an entry', () => {
    it('then the ours side of the conflict is empty', async () => {
      // Arrange
      const theirs = keyless('true') + second

      // Act
      const result = await mergeXmlStrings(sut, doc(pair), doc(''), doc(theirs))

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(conflictSides(result.output).map(countOpenTags)).toEqual([0, 2, 2])
    })
  })

  describe('when the entries are ordered', () => {
    it('then divergent edits conflict with both entries per side', async () => {
      // Arrange
      const root = (body: string) =>
        `<GlobalValueSet xmlns="http://soap.sforce.com/2006/04/metadata">${body}<sorted>false</sorted></GlobalValueSet>`
      const value = (label: string) =>
        `<customValue><label>${label}</label></customValue>`
      const open = /<customValue>/g

      // Act
      const result = await mergeXmlStrings(
        sut,
        root(value('x') + value('y')),
        root(value('x2') + value('y')),
        root(value('x') + value('y2'))
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      const counts = conflictSides(result.output).map(
        side => side.match(open)?.length ?? 0
      )
      expect(counts).toEqual([2, 2, 2])
    })
  })
})
