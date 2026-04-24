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
})
