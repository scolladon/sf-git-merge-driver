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
const keyed = (editable: string, field = 'Account.X__c'): string =>
  `<fieldPermissions><editable>${editable}</editable><field>${field}</field></fieldPermissions>`
const keyedAsUndefined = (editable: string): string =>
  keyed(editable, 'undefined')
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
        'each side edits another entry and an entry stands between them',
        doc(pair + keyless('maybe', 'maybe')),
        doc(keyless('true') + second + keyless('maybe', 'maybe')),
        doc(pair + keyless('maybe', 'maybe')),
        doc(keyless('true') + second + keyless('maybe', 'maybe')),
      ],
      [
        'an entry key is repeated',
        doc(keyed('false') + keyed('true')),
        doc(keyed('false') + keyed('true'), 'true'),
        doc(keyed('false') + keyed('true')),
        doc(keyed('false') + keyed('true'), 'true'),
      ],
      [
        'a real key is spelled "undefined" beside a keyless entry',
        doc(keyedAsUndefined('false') + keyless()),
        doc(keyedAsUndefined('false') + keyless(), 'true'),
        doc(keyedAsUndefined('true') + keyless()),
        doc(keyedAsUndefined('true') + keyless(), 'true'),
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

  describe('when each side edits a neighbouring entry', () => {
    it('then each replacement keeps the place of its entry and both merge', async () => {
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
      expect(result.hasConflict).toBe(false)
      expect(parser.parseString(result.output)).toEqual(
        parser.parseString(doc(keyless('true') + secondEdited))
      )
    })
  })

  describe('when each side edits the lone entry differently', () => {
    it('then the two replacements of its content conflict at one place', async () => {
      // Act
      const result = await mergeXmlStrings(
        sut,
        doc(keyless()),
        doc(keyless('true')),
        doc(keyless('false', 'true'))
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(conflictSides(result.output).map(countOpenTags)).toEqual([1, 1, 1])
    })
  })

  describe('when ours deletes the array and theirs edits an entry', () => {
    it('then it merges as the entry removed and the edit added', async () => {
      // Arrange
      const theirs = keyless('true') + second

      // Act
      const result = await mergeXmlStrings(sut, doc(pair), doc(''), doc(theirs))

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(parser.parseString(result.output)).toEqual(
        parser.parseString(doc(keyless('true')))
      )
    })
  })

  describe('when only the ancestor holds both entries and each side deletes a different one', () => {
    it('then both deletions apply and no entry is left', async () => {
      // Arrange
      const ours = keyless()
      const theirs = second

      // Act
      const result = await mergeXmlStrings(
        sut,
        doc(pair),
        doc(ours),
        doc(theirs)
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).not.toContain('<fieldPermissions>')
    })
  })

  describe('when the entries are ordered', () => {
    const root = (body: string) =>
      `<GlobalValueSet xmlns="http://soap.sforce.com/2006/04/metadata">${body}<sorted>false</sorted></GlobalValueSet>`
    const value = (label: string) =>
      `<customValue><label>${label}</label></customValue>`
    const labels = (side: string) =>
      Array.from(side.matchAll(/<label>([^<]*)<\/label>/g), m => m[1])

    it('then edits of neighbours on each side both merge', async () => {
      // Act
      const result = await mergeXmlStrings(
        sut,
        root(value('x') + value('y')),
        root(value('x2') + value('y')),
        root(value('x') + value('y2'))
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(labels(result.output)).toEqual(['x2', 'y2'])
    })

    it('then divergent edits standing apart merge', async () => {
      // Act
      const result = await mergeXmlStrings(
        sut,
        root(value('x') + value('m') + value('y')),
        root(value('x2') + value('m') + value('y')),
        root(value('x') + value('m') + value('y2'))
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(labels(result.output)).toEqual(['x2', 'm', 'y2'])
    })
  })
})
