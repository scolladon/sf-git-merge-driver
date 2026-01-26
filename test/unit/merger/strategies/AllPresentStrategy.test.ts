import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { AllPresentStrategy } from '../../../../src/merger/strategies/AllPresentStrategy.js'
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
  ancestor: { a: 'ancestorA' },
  local: { a: 'localA' },
  other: { a: 'otherA' },
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('AllPresentStrategy', () => {
  const strategy = new AllPresentStrategy()

  describe('without rootKey', () => {
    it('should merge all children', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'ancestorA', b: 'ancestorB' },
        local: { a: 'localA', b: 'localB' },
        other: { a: 'otherA', b: 'otherB' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should handle three-way merge with no conflict', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'original' },
        local: { a: 'localChange' },
        other: { a: 'original' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(false)
    })

    it('should return early when ancestor, local, and other are identical', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'same' },
        local: { a: 'same' },
        other: { a: 'same' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBeDefined()
    })

    it('should detect conflict when both sides change differently', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'original' },
        local: { a: 'localChange' },
        other: { a: 'otherChange' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should handle disjoint changes without conflict', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'ancestorA', b: 'ancestorB' },
        local: { a: 'localA', b: 'ancestorB' },
        other: { a: 'ancestorA', b: 'otherB' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('with rootKey', () => {
    it('should wrap result with rootKey when rootKey is provided', () => {
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
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should return empty key when result is empty with rootKey', () => {
      // Arrange
      const context = createContext({
        ancestor: {},
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
})
