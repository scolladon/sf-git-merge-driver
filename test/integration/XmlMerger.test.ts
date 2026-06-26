import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

describe('XmlMerger integration', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('parser options', () => {
    it('given XML with attributes when merging then preserves attributes', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://test.com"><Field editable="true">value</Field></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('editable')
    })

    it('given XML with numeric strings when merging then preserves as strings', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Code>007</Code><Hex>0x1F</Hex></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('007')
      expect(result.output).toContain('0x1F')
    })

    it('given XML with special entities when merging then preserves raw entities', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Text>&amp;foo &lt;bar&gt;</Text></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('&amp;foo')
    })

    it('given XML with boolean-like tag values when merging then preserves as strings', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Required>false</Required><Active>true</Active></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('false')
      expect(result.output).toContain('true')
      expect(result.output).not.toContain('<Required/>')
      expect(result.output).not.toContain('<Active/>')
    })

    it('given XML with declaration when merging then output has exactly one declaration', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Field>value</Field></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      const declCount = (result.output.match(/<\?xml version="1.0"/g) ?? [])
        .length
      expect(declCount).toBe(1)
    })

    it('given XML with CDATA when merging then preserves CDATA sections', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Script><![CDATA[if (a < b) {}]]></Script></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('<![CDATA[')
    })
  })

  describe('builder options', () => {
    it('given non-empty XML when merging then output is formatted with indentation', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Field>value</Field></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.output).toContain('    ')
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    })
  })

  describe('comment handling', () => {
    it('given XML with comments when merging then emits comments inline', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><!-- my comment --><Field>value</Field></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.output).toContain('<!--')
      expect(result.output).toContain('-->')
      // No builder-inserted whitespace around comments: the writer
      // emits them inline by construction (design §6.3.2 rule 4).
      expect(result.output).not.toMatch(/\s+<!--.*-->\s+/)
    })

    it('given XML without comments when merging then no comment syntax appears', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Field>value</Field></Root>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).not.toContain('<!--')
    })
  })

  describe('empty input', () => {
    it('given empty files when merging then returns empty output', async () => {
      const result = await mergeXmlStrings(sut, '', '', '')
      expect(result.output).toBe('')
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('RecordType picklistValues', () => {
    // Regression: the picklistValues key extractor used `masterLabel`
    // (the CustomObjectTranslation schema), which collapsed every
    // RecordType `<picklistValues>` block to a single Map entry under
    // the literal key `"undefined"` (since RecordType.picklistValues is
    // keyed by `picklist`, not `masterLabel`). Only the last block
    // survived the merge.
    const recordType = (extras: { stageExtra?: string } = {}) =>
      `<?xml version="1.0" encoding="UTF-8"?>
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Agency_Development</fullName>
    <active>true</active>
    <label>Agency Development</label>
    <picklistValues>
        <picklist>StageName</picklist>
        <values><fullName>Prospecting</fullName><default>false</default></values>
        <values><fullName>Qualification</fullName><default>false</default></values>${extras.stageExtra ?? ''}
    </picklistValues>
    <picklistValues>
        <picklist>LeadSource</picklist>
        <values><fullName>Web</fullName><default>false</default></values>
        <values><fullName>Phone</fullName><default>false</default></values>
    </picklistValues>
    <picklistValues>
        <picklist>Vacant_Properties__c</picklist>
        <values><fullName>Yes</fullName><default>false</default></values>
        <values><fullName>No</fullName><default>true</default></values>
    </picklistValues>
</RecordType>`

    it('given RecordType with three picklistValues when one side adds a value then all blocks preserved', async () => {
      const ancestor = recordType()
      const ours = recordType()
      const theirs = recordType({
        stageExtra:
          '\n        <values><fullName>Negotiation</fullName><default>false</default></values>',
      })
      const result = await mergeXmlStrings(sut, ancestor, ours, theirs)
      expect(result.hasConflict).toBe(false)
      expect((result.output.match(/<picklistValues>/g) ?? []).length).toBe(3)
      expect(result.output).toContain('<picklist>StageName</picklist>')
      expect(result.output).toContain('<picklist>LeadSource</picklist>')
      expect(result.output).toContain(
        '<picklist>Vacant_Properties__c</picklist>'
      )
      expect(result.output).toContain('Negotiation')
    })

    it('given RecordType with three picklistValues when merging equal subtrees then all blocks preserved', async () => {
      const xml = recordType()
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect((result.output.match(/<picklistValues>/g) ?? []).length).toBe(3)
    })
  })

  describe('real three-way merge', () => {
    it('given local adds field when merging then output contains new field', async () => {
      const ancestor = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`
      const local = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`
      const other = ancestor
      const result = await mergeXmlStrings(sut, ancestor, local, other)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('Account.Phone')
      expect(result.output).toContain('Account.Name')
    })
  })

  describe('empty root preservation (residual #3)', () => {
    const NS = 'http://soap.sforce.com/2006/04/metadata'

    it('given an empty self-closing root when identity-merging then preserves the root as an empty element (not a blank file)', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"/>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>\n`
      )
    })

    it('given an empty open/close root when identity-merging then preserves the root identically', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>`
      const result = await mergeXmlStrings(sut, xml, xml, xml)
      expect(result.output).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>\n`
      )
    })

    it('given both sides emptied a populated root when merging then emits the empty root, not a blank file', async () => {
      const ancestor = `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"><x>1</x></SharingRules>`
      const emptied = `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>`
      const result = await mergeXmlStrings(sut, ancestor, emptied, emptied)
      expect(result.output).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>\n`
      )
    })

    it('given an empty ancestor file but both sides add the same empty root then preserves the root (scans past the keyless side)', async () => {
      // ancestor parses to {} (no root); ours/theirs each add an empty
      // SharingRules. preserveEmptyRoot must scan past the keyless ancestor
      // to find the root on a later side.
      const root = `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"/>`
      const result = await mergeXmlStrings(sut, '', root, root)
      expect(result.output).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<SharingRules xmlns="${NS}"></SharingRules>\n`
      )
    })

    it('given a truly empty document (no root element) when merging then emits nothing', async () => {
      // The other-extreme: with no root key in any side there is nothing to
      // preserve, so the output stays byte-empty (writer short-circuit).
      const result = await mergeXmlStrings(sut, '', '', '')
      expect(result.output).toBe('')
      expect(result.hasConflict).toBe(false)
    })
  })
})
