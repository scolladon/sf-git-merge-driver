import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../../utils/mergeXmlStrings.js'
import { defaultConfig } from '../../utils/testConfig.js'

const NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

const file = (root: string, body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${NAMESPACE}">\n${body}</${root}>\n`

interface Kind {
  readonly name: string
  readonly root: string
  readonly kept: string
  readonly entry: string
  readonly reordered: string
}

const KINDS: readonly Kind[] = [
  {
    name: 'an unordered keyed entry',
    root: 'Profile',
    kept: '    <userLicense>Salesforce</userLicense>\n',
    entry:
      '    <fieldPermissions>\n        <editable>true</editable>\n        <field>Account.F</field>\n        <readable>true</readable>\n    </fieldPermissions>\n',
    reordered:
      '    <fieldPermissions>\n        <field>Account.F</field>\n        <editable>true</editable>\n        <readable>true</readable>\n    </fieldPermissions>\n',
  },
  {
    name: 'an ordered keyed entry',
    root: 'GlobalValueSet',
    kept: '    <masterLabel>X</masterLabel>\n',
    entry:
      '    <customValue>\n        <default>false</default>\n        <fullName>V1</fullName>\n        <label>V1</label>\n    </customValue>\n',
    reordered:
      '    <customValue>\n        <fullName>V1</fullName>\n        <default>false</default>\n        <label>V1</label>\n    </customValue>\n',
  },
  {
    name: 'a keyless element',
    root: 'Profile',
    kept: '    <userLicense>Salesforce</userLicense>\n',
    entry:
      '    <valueSetDefinition>\n        <first>100</first>\n        <second>200</second>\n    </valueSetDefinition>\n',
    reordered:
      '    <valueSetDefinition>\n        <second>200</second>\n        <first>100</first>\n    </valueSetDefinition>\n',
  },
  {
    name: 'a keyless element among repeated ones',
    root: 'Profile',
    kept: '    <userLicense>Salesforce</userLicense>\n',
    entry:
      '    <loginFlows>\n        <flow>a</flow>\n        <flowType>x</flowType>\n    </loginFlows>\n    <loginFlows>\n        <flow>b</flow>\n        <flowType>x</flowType>\n    </loginFlows>\n',
    reordered:
      '    <loginFlows>\n        <flowType>x</flowType>\n        <flow>a</flow>\n    </loginFlows>\n    <loginFlows>\n        <flow>b</flow>\n        <flowType>x</flowType>\n    </loginFlows>\n',
  },
]

const merged = (ancestor: string, ours: string, theirs: string) =>
  mergeXmlStrings(new XmlMerger(defaultConfig), ancestor, ours, theirs)

describe('given one side deletes an entry and the other only reorders its child tags', () => {
  describe.each(KINDS)('with $name', kind => {
    const ancestor = file(kind.root, kind.kept + kind.entry)
    const deleted = file(kind.root, kind.kept)
    const reordered = file(kind.root, kind.kept + kind.reordered)

    it('when the deleter is ours then the merge conflicts', async () => {
      // Act
      const sut = await merged(ancestor, deleted, reordered)

      // Assert
      expect(sut.hasConflict).toBe(true)
    })

    it('when the deleter is theirs then the merge conflicts', async () => {
      // Act
      const sut = await merged(ancestor, reordered, deleted)

      // Assert
      expect(sut.hasConflict).toBe(true)
    })

    it('when the other side leaves the entry as it was then the deletion wins', async () => {
      // Act
      const sut = await merged(ancestor, deleted, ancestor)

      // Assert
      expect(sut).toEqual({ output: deleted, hasConflict: false })
    })
  })
})
