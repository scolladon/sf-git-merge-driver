import { describe, expect, it } from 'vitest'
import { FlxXmlParser } from '../../../src/adapter/FlxXmlParser.js'

describe('FlxXmlParser', () => {
  const sut = new FlxXmlParser()

  describe('given XML with namespace attributes', () => {
    it('when parsing then extracts namespaces separately from content', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>false</custom>
</Profile>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect(result.namespaces).toEqual({
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      })
      expect(result.content).toEqual({
        Profile: { custom: 'false' },
      })
    })
  })

  describe('given XML with declaration attributes', () => {
    it('when parsing then strips declaration attributes from content', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><value>test</value></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect(result.content).toEqual({ Root: { value: 'test' } })
      expect(result.content).not.toHaveProperty('Root.@_version')
      expect(result.content).not.toHaveProperty('Root.@_encoding')
    })
  })

  describe('given XML with CDATA', () => {
    it('when parsing then preserves CDATA without empty text node', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><script><![CDATA[if (a < b) {}]]></script></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      const script = (result.content as Record<string, unknown>).Root as Record<
        string,
        unknown
      >
      expect(script).toHaveProperty('script')
      const scriptNode = script.script as Record<string, unknown>
      expect(scriptNode.__cdata).toBe('if (a < b) {}')
      expect(scriptNode).not.toHaveProperty('#text')
    })
  })

  describe('given XML with numeric strings', () => {
    it('when parsing then preserves as strings', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><code>007</code><hex>0x1F</hex></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect((result.content as Record<string, unknown>).Root).toEqual({
        code: '007',
        hex: '0x1F',
      })
    })
  })

  describe('given XML with entities', () => {
    it('when parsing then preserves raw entities', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><text>&amp;foo &lt;bar&gt;</text></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect((result.content as Record<string, unknown>).Root).toEqual({
        text: '&amp;foo &lt;bar&gt;',
      })
    })
  })

  describe('given XML with comments', () => {
    it('when parsing then captures comments', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><!-- a comment --><value>test</value></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect((result.content as Record<string, unknown>).Root).toHaveProperty(
        '#xml__comment'
      )
    })
  })

  describe('given XML with array root child', () => {
    it('when parsing then skips array children for namespace extraction', () => {
      // Arrange — two <item> elements produce an array value
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://test.com"><item>a</item><item>b</item></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect(result.namespaces).toEqual({
        '@_xmlns': 'http://test.com',
      })
      expect(result.content).toEqual({
        Root: { item: ['a', 'b'] },
      })
    })
  })

  describe('given XML without namespace attributes', () => {
    it('when parsing then returns empty namespaces', () => {
      // Arrange
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root><value>test</value></Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given XML with text-only root element', () => {
    it('when parsing then skips non-object root child for namespace extraction', () => {
      // Arrange — text-only element wraps content in #text object
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root>plain text content</Root>`

      // Act
      const result = sut.parse(xml)

      // Assert
      expect(result.namespaces).toEqual({})
      expect(result.content).toHaveProperty('Root')
    })
  })
})
