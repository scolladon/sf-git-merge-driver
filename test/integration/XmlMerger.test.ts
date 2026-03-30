import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { defaultConfig } from '../utils/testConfig.js'

describe('XmlMerger integration', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('parser options', () => {
    it('given XML with attributes when merging then preserves attributes', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://test.com"><Field editable="true">value</Field></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.hasConflict).toBe(false)
      // preserveOrder mode serializes attributes as child elements
      expect(result.output).toContain('editable')
    })

    it('given XML with numeric strings when merging then preserves as strings', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Code>007</Code><Hex>0x1F</Hex></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('007')
      expect(result.output).toContain('0x1F')
    })

    it('given XML with special entities when merging then preserves raw entities', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Text>&amp;foo &lt;bar&gt;</Text></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('&amp;foo')
    })

    it('given XML with CDATA when merging then preserves CDATA sections', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Script><![CDATA[if (a < b) {}]]></Script></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('<![CDATA[')
    })
  })

  describe('builder options', () => {
    it('given non-empty XML when merging then output is formatted with indentation', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Field>value</Field></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.output).toContain('    ')
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    })
  })

  describe('comment correction', () => {
    it('given XML with comments when merging then removes extra whitespace around comments', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><!-- my comment --><Field>value</Field></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.output).toContain('<!--')
      expect(result.output).toContain('-->')
      // Comment should not have leading/trailing whitespace from builder formatting
      expect(result.output).not.toMatch(/\s+<!--.*-->\s+/)
    })

    it('given XML without comments when merging then skips comment correction', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><Field>value</Field></Root>`

      // Act
      const result = sut.mergeThreeWay(xml, xml, xml)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).not.toContain('<!--')
    })
  })

  describe('empty input', () => {
    it('given empty files when merging then returns empty output', () => {
      // Act
      const result = sut.mergeThreeWay('', '', '')

      // Assert
      expect(result.output).toBe('')
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('real three-way merge', () => {
    it('given local adds field when merging then output contains new field', () => {
      // Arrange
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

      // Act
      const result = sut.mergeThreeWay(ancestor, local, other)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('Account.Phone')
      expect(result.output).toContain('Account.Name')
    })
  })
})
