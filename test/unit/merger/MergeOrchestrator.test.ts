import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { MergeOrchestrator } from '../../../src/merger/MergeOrchestrator.js'
import { defaultNodeFactory } from '../../../src/merger/nodes/MergeNodeFactory.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('MergeOrchestrator', () => {
  describe('constructor', () => {
    it('should use default nodeFactory when not provided', () => {
      // Arrange & Act - covers the default parameter branch
      const orchestrator = new MergeOrchestrator(defaultConfig)

      // Assert - verify it works with default factory
      const result = orchestrator.merge({ key: 'value' }, { key: 'value' }, {})

      expect(result.hasConflict).toBe(false)
    })

    it('should use provided nodeFactory when specified', () => {
      // Arrange & Act
      const orchestrator = new MergeOrchestrator(
        defaultConfig,
        defaultNodeFactory
      )

      // Assert
      const result = orchestrator.merge({ key: 'value' }, {}, { key: 'value' })

      expect(result.hasConflict).toBe(false)
    })
  })

  describe('merge', () => {
    it('should merge with rootKey parameter', () => {
      // Arrange
      const orchestrator = new MergeOrchestrator(defaultConfig)

      // Act
      const result = orchestrator.merge(
        { key: 'ancestor' },
        { key: 'local' },
        { key: 'other' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      // Assert
      expect(result.output).toBeDefined()
    })

    it('should merge with attribute parameter', () => {
      // Arrange
      const orchestrator = new MergeOrchestrator(defaultConfig)

      // Act
      const result = orchestrator.merge(
        { key: 'ancestor' },
        { key: 'local' },
        { key: 'other' },
        'testAttr'
      )

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('mergeObject', () => {
    it('should merge objects', () => {
      // Arrange
      const orchestrator = new MergeOrchestrator(defaultConfig)

      // Act
      const result = orchestrator.mergeObject(
        { a: 'ancestor' },
        { a: 'local' },
        { a: 'other' }
      )

      // Assert
      expect(result).toBeDefined()
    })

    it('should merge arrays', () => {
      // Arrange
      const orchestrator = new MergeOrchestrator(defaultConfig)

      // Act
      const result = orchestrator.mergeObject(['a'], ['b'], ['c'])

      // Assert
      expect(result).toBeDefined()
    })
  })
})
