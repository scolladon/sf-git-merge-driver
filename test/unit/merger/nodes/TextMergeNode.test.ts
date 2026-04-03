import { describe, expect, it } from 'vitest'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { TextMergeNode } from '../../../../src/merger/nodes/TextMergeNode.js'
import { defaultConfig } from '../../../utils/testConfig.js'

describe('TextMergeNode', () => {
  describe('merge', () => {
    it('should return local value when local equals other (both present, no ancestor)', () => {
      // Arrange
      const node = new TextMergeNode(null, 'value', 'value', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'value' }] }])
    })

    it('should return local value when local equals other (all present)', () => {
      // Arrange
      const node = new TextMergeNode('ancestor', 'same', 'same', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'same' }] }])
    })

    it('should return other when only other is present', () => {
      // Arrange
      const node = new TextMergeNode(null, null, 'other', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'other' }] }])
    })

    it('should return local when only local is present', () => {
      // Arrange
      const node = new TextMergeNode(null, 'local', null, 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'local' }] }])
    })

    it('should return empty when only ancestor is present (deleted in both)', () => {
      // Arrange
      const node = new TextMergeNode('ancestor', null, null, 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })

    it('should return other when ancestor equals local (other changed)', () => {
      // Arrange
      const node = new TextMergeNode('ancestor', 'ancestor', 'other', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'other' }] }])
    })

    it('should return local when ancestor equals other (local changed)', () => {
      // Arrange
      const node = new TextMergeNode('ancestor', 'local', 'ancestor', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 'local' }] }])
    })

    it('should return conflict when all three differ', () => {
      // Arrange
      const node = new TextMergeNode('ancestor', 'local', 'other', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('given all present and local differs from other when merging then does not use early exit', () => {
      // Arrange — local !== other, so the early exit must NOT fire
      const node = new TextMergeNode(
        'ancestor',
        'localVal',
        'otherVal',
        'field'
      )

      // Act
      const result = node.merge(defaultConfig)

      // Assert — must detect conflict, not short-circuit to noConflict
      expect(result.hasConflict).toBe(true)
    })

    it('should return conflict when local and other differ (no ancestor)', () => {
      // Arrange
      const node = new TextMergeNode(null, 'local', 'other', 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should handle numeric values', () => {
      // Arrange
      const node = new TextMergeNode(1, 2, 2, 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: 2 }] }])
    })

    it('should handle boolean values', () => {
      // Arrange
      const node = new TextMergeNode(false, true, true, 'field')

      // Act
      const result = node.merge(defaultConfig)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([{ field: [{ [TEXT_TAG]: true }] }])
    })
  })
})
