import { describe, expect, it } from 'vitest'
import { FxpXmlSerializer } from '../../../src/adapter/FxpXmlSerializer.js'
import { buildConflictBlock } from '../../../src/types/conflictBlock.js'
import type { JsonArray } from '../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../utils/testConfig.js'

describe('FxpXmlSerializer', () => {
  const sut = new FxpXmlSerializer(defaultConfig)

  describe('given compact merged output with namespaces', () => {
    it('when serializing then converts to ordered format and inserts namespace', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [{ value: 'test' }],
        },
      ]
      const namespaces = {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      }

      // Act
      const result = sut.serialize(mergedOutput, namespaces)

      // Assert
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain(
        'xmlns="http://soap.sforce.com/2006/04/metadata"'
      )
      expect(result).toContain('<value>test</value>')
    })
  })

  describe('given compact merged output without namespaces', () => {
    it('when serializing then produces valid XML', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [{ value: 'hello' }],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('<Root>')
      expect(result).toContain('<value>hello</value>')
      expect(result).not.toContain('xmlns')
    })
  })

  describe('given compact merged output with ConflictBlock', () => {
    it('when serializing then expands conflict to markers in XML', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [
            buildConflictBlock(
              { value: 'local-value' },
              {},
              { value: 'other-value' }
            ),
          ],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<<<<<<< ours')
      expect(result).toContain('>>>>>>> theirs')
      expect(result).toContain('<value>local-value</value>')
      expect(result).toContain('<value>other-value</value>')
    })

    it('when serializing with empty conflict side then handles empty content', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [buildConflictBlock({}, {}, { value: 'added' })],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<<<<<<< ours')
      expect(result).toContain('>>>>>>> theirs')
      expect(result).toContain('<value>added</value>')
    })
  })

  describe('given compact output with nested objects', () => {
    it('when serializing then recursively converts nested structure', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [{ parent: { child: 'nested-value' } }],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<parent>')
      expect(result).toContain('<child>nested-value</child>')
      expect(result).toContain('</parent>')
    })
  })

  describe('given compact output with nil values', () => {
    it('when serializing then handles null gracefully', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: [{ value: null as unknown as string }],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<Root>')
    })
  })

  describe('given conflict with scalar values in content', () => {
    it('when serializing then wraps scalars as text nodes', () => {
      // Arrange - conflict content containing scalar values
      const mergedOutput = [
        {
          Root: [
            buildConflictBlock(
              ['scalar-local'] as unknown as Record<string, unknown>,
              ['scalar-base'] as unknown as Record<string, unknown>,
              ['scalar-other'] as unknown as Record<string, unknown>
            ),
          ],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('scalar-local')
      expect(result).toContain('scalar-other')
    })
  })

  describe('given array with scalar child elements', () => {
    it('when serializing then converts scalar array items', () => {
      // Arrange
      const mergedOutput = [
        {
          Root: ['text-item-1', 'text-item-2'],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('text-item-1')
      expect(result).toContain('text-item-2')
    })
  })

  describe('given conflict with completely empty content arrays', () => {
    it('when serializing then uses EOL placeholder for empty sides', () => {
      // Arrange — empty arrays trigger the isEmpty branch
      const mergedOutput = [
        {
          Root: [
            {
              __conflict: true as const,
              local: [],
              ancestor: [],
              other: [{ value: 'added' }],
            },
          ],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<<<<<<< ours')
      expect(result).toContain('<value>added</value>')
    })
  })

  describe('given ConflictBlock as direct property value', () => {
    it('when serializing then expands conflict inline', () => {
      // Arrange — conflict block as a direct object property (not in array)
      const mergedOutput = [
        {
          Root: [
            {
              wrapper: buildConflictBlock(
                { inner: 'local' },
                { inner: 'base' },
                { inner: 'other' }
              ),
            },
          ],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<<<<<<< ours')
      expect(result).toContain('>>>>>>> theirs')
    })
  })

  describe('given scalar at top level of merge output', () => {
    it('when serializing then wraps as text node', () => {
      // Arrange — scalar at root level (edge case)
      const mergedOutput = ['raw-text' as unknown] as unknown[]

      // Act
      const result = sut.serialize(mergedOutput as JsonArray, {})

      // Assert
      expect(result).toContain('raw-text')
    })
  })

  describe('given nested ConflictBlock inside conflict content', () => {
    it('when serializing then recursively expands nested conflicts', () => {
      // Arrange — nested conflict within conflict content
      const innerConflict = buildConflictBlock(
        { deep: 'localDeep' },
        { deep: 'baseDeep' },
        { deep: 'otherDeep' }
      )
      const mergedOutput = [
        {
          Root: [
            buildConflictBlock(
              [innerConflict] as unknown as Record<string, unknown>,
              { shallow: 'base' },
              { shallow: 'other' }
            ),
          ],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<<<<<<< ours')
      expect(result).toContain('>>>>>>> theirs')
      expect(result).toContain('localDeep')
    })
  })

  describe('given output with null text value', () => {
    it('when serializing then produces empty element', () => {
      // Arrange - wrapText receives null value
      const mergedOutput: JsonArray = [
        {
          Root: [{ tag: null as unknown as string }],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<Root>')
      expect(result).not.toContain('<tag>')
    })
  })

  describe('given output with XML comments', () => {
    it('when serializing then corrects comment whitespace', () => {
      // Arrange - XML comments use the '!--' property
      const mergedOutput: JsonArray = [
        {
          Root: [{ '!--': [{ '#text': 'test comment' }] }],
        },
      ]

      // Act
      const result = sut.serialize(mergedOutput, {})

      // Assert
      expect(result).toContain('<!--')
      expect(result).toContain('-->')
    })
  })

  describe('given empty output array', () => {
    it('when serializing with namespaces then does not insert namespaces', () => {
      // Arrange - empty output should skip namespace insertion
      const mergedOutput: JsonArray = []
      const namespaces = {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      }

      // Act
      const result = sut.serialize(mergedOutput, namespaces)

      // Assert
      expect(result).not.toContain('xmlns')
    })
  })

  describe('given non-empty output with empty namespaces', () => {
    it('when serializing then skips namespace insertion', () => {
      // Arrange
      const mergedOutput: JsonArray = [{ Root: [{ val: 'test' }] }]
      const namespaces = {}

      // Act
      const result = sut.serialize(mergedOutput, namespaces)

      // Assert
      expect(result).not.toContain('xmlns')
      expect(result).toContain('<val>test</val>')
    })
  })
})
