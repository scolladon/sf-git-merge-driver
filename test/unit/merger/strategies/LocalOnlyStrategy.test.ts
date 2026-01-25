import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { LocalOnlyStrategy } from '../../../../src/merger/strategies/LocalOnlyStrategy.js'
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
  ancestor: {},
  local: { key: 'localValue' },
  other: {},
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('LocalOnlyStrategy', () => {
  const strategy = new LocalOnlyStrategy()

  describe('without rootKey', () => {
    it('should return transformed local content', () => {
      // Arrange
      const context = createContext()

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toHaveLength(1)
      expect(result.hasConflict).toBe(false)
    })

    it('should transform nested objects', () => {
      // Arrange
      const context = createContext({
        local: { outer: { inner: 'value' } },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toHaveLength(1)
      expect(result.hasConflict).toBe(false)
    })

    it('should handle empty local object', () => {
      // Arrange
      const context = createContext({ local: {} })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('with rootKey', () => {
    it('should wrap with rootKey when rootKey is provided', () => {
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
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      expect(result.hasConflict).toBe(false)
    })

    it('should wrap empty content with rootKey', () => {
      // Arrange
      const context = createContext({
        local: {},
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
  })
})
