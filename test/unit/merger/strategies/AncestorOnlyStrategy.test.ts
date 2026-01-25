import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { AncestorOnlyStrategy } from '../../../../src/merger/strategies/AncestorOnlyStrategy.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const createContext = (
  overrides: Partial<MergeContext> = {}
): MergeContext => ({
  config: defaultConfig,
  ancestor: { value: 'ancestor' },
  local: {},
  other: {},
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('AncestorOnlyStrategy', () => {
  const strategy = new AncestorOnlyStrategy()

  describe('without rootKey', () => {
    it('should return empty result with no conflict', () => {
      // Arrange
      const context = createContext()

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('with rootKey', () => {
    it('should return empty key when rootKey exists in local', () => {
      // Arrange
      const context = createContext({
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: false,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when rootKey exists in other', () => {
      // Arrange
      const context = createContext({
        rootKey: {
          name: 'testKey',
          existsInLocal: false,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when rootKey exists in both', () => {
      // Arrange
      const context = createContext({
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty result when rootKey exists in neither', () => {
      // Arrange
      const context = createContext({
        rootKey: {
          name: 'testKey',
          existsInLocal: false,
          existsInOther: false,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })
})
