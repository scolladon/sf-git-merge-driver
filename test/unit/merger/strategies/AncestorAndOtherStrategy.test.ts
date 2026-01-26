import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { AncestorAndOtherStrategy } from '../../../../src/merger/strategies/AncestorAndOtherStrategy.js'
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
  ancestor: { key: 'ancestorValue' },
  local: {},
  other: { key: 'otherValue' },
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('AncestorAndOtherStrategy', () => {
  const strategy = new AncestorAndOtherStrategy()

  describe('without rootKey', () => {
    it('should return empty when ancestor equals other', () => {
      // Arrange
      const context = createContext({
        ancestor: { key: 'sameValue' },
        other: { key: 'sameValue' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when ancestor and other differ', () => {
      // Arrange
      const context = createContext()

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(true)
    })

    it('should handle multi-element arrays in extractContent', () => {
      // Arrange
      const context = createContext({
        ancestor: { a: 'ancestorA', b: 'ancestorB' },
        other: { a: 'otherA', b: 'otherB' },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('with attribute', () => {
    it('should return conflict with attribute wrapping', () => {
      // Arrange
      const context = createContext({ attribute: 'testAttr' })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.hasConflict).toBe(true)
    })
  })

  describe('with rootKey', () => {
    it('should return empty when local missing and other unchanged', () => {
      // Arrange
      const context = createContext({
        ancestor: { key: 'value' },
        other: { key: 'value' },
        rootKey: {
          name: 'testKey',
          existsInLocal: false,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when local missing and other changed', () => {
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
      expect(result.hasConflict).toBe(true)
    })

    it('should wrap result with rootKey when local exists', () => {
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

    it('should return empty key when local exists but nested result is empty', () => {
      // Arrange
      const context = createContext({
        ancestor: { key: 'value' },
        other: { key: 'value' },
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
