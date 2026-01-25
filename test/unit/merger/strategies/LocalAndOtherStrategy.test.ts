import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { LocalAndOtherStrategy } from '../../../../src/merger/strategies/LocalAndOtherStrategy.js'
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
  other: { key: 'otherValue' },
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('LocalAndOtherStrategy', () => {
  const strategy = new LocalAndOtherStrategy()

  describe('when local equals other', () => {
    it('should return other content without conflict', () => {
      // Arrange
      const context = createContext({
        local: { key: 'sameValue' },
        other: { key: 'sameValue' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should wrap with rootKey when equal and rootKey is provided', () => {
      // Arrange
      const context = createContext({
        local: { key: 'sameValue' },
        other: { key: 'sameValue' },
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when both are empty with rootKey', () => {
      // Arrange
      const context = createContext({
        local: {},
        other: {},
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
  })

  describe('when local differs from other', () => {
    it('should merge children', () => {
      // Arrange
      const context = createContext({
        local: { a: 'localA', b: 'shared' },
        other: { a: 'otherA', b: 'shared' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should wrap merged result with rootKey when rootKey is provided', () => {
      // Arrange
      const context = createContext({
        local: { a: 'localA' },
        other: { a: 'otherA' },
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should handle disjoint keys', () => {
      // Arrange
      const context = createContext({
        local: { a: 'localA' },
        other: { b: 'otherB' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output.length).toBeGreaterThan(0)
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when mergeChildren returns empty with rootKey', () => {
      // Arrange
      const context = createContext({
        local: { a: null },
        other: { b: null },
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })
  })
})
