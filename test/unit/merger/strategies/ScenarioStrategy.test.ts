import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { getScenarioStrategy } from '../../../../src/merger/strategies/ScenarioStrategy.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import { MergeScenario } from '../../../../src/types/mergeScenario.js'

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
  local: {},
  other: {},
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('ScenarioStrategy', () => {
  describe('getScenarioStrategy', () => {
    it.each([
      MergeScenario.NONE,
      MergeScenario.OTHER_ONLY,
      MergeScenario.LOCAL_ONLY,
      MergeScenario.LOCAL_AND_OTHER,
      MergeScenario.ANCESTOR_ONLY,
      MergeScenario.ANCESTOR_AND_OTHER,
      MergeScenario.ANCESTOR_AND_LOCAL,
      MergeScenario.ALL,
    ])('should return a strategy for %s', scenario => {
      // Act
      const strategy = getScenarioStrategy(scenario)

      // Assert
      expect(strategy).toBeDefined()
      expect(strategy.execute).toBeDefined()
    })
  })

  describe('NoneStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.NONE)

    it('should return empty result with no conflict', () => {
      // Arrange
      const context = createContext()

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should ignore ancestor value', () => {
      // Arrange
      const context = createContext({ ancestor: { key: 'value' } })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should ignore rootKey', () => {
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
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should ignore attribute', () => {
      // Arrange
      const context = createContext({ attribute: 'testAttr' })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('OtherOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.OTHER_ONLY)

    describe('without rootKey', () => {
      it('should return transformed other content', () => {
        // Arrange
        const context = createContext({
          other: { key: 'otherValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should transform nested objects', () => {
        // Arrange
        const context = createContext({
          other: { outer: { inner: 'value' } },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should handle empty other object', () => {
        // Arrange
        const context = createContext({ other: {} })

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
          other: { key: 'otherValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
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
          other: {},
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
    })
  })

  describe('LocalOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.LOCAL_ONLY)

    describe('without rootKey', () => {
      it('should return transformed local content', () => {
        // Arrange
        const context = createContext({
          local: { key: 'localValue' },
        })

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
          local: { key: 'localValue' },
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

  describe('LocalAndOtherStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.LOCAL_AND_OTHER)

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

  describe('AncestorOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_ONLY)

    describe('without rootKey', () => {
      it('should return empty result with no conflict', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
        })

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
          ancestor: { value: 'ancestor' },
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
          ancestor: { value: 'ancestor' },
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
          ancestor: { value: 'ancestor' },
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
          ancestor: { value: 'ancestor' },
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

  describe('AncestorAndLocalStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)

    describe('without rootKey', () => {
      it('should return empty when ancestor equals local', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'sameValue' },
          local: { key: 'sameValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when ancestor and local differ', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should handle multi-element arrays in extractContent', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA', b: 'ancestorB' },
          local: { a: 'localA', b: 'localB' },
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
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
          attribute: 'testAttr',
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })

    describe('with rootKey', () => {
      it('should return empty key when other missing and local unchanged', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          local: { key: 'value' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when other missing and local changed', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should wrap result with rootKey when other exists', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
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

      it('should return empty key when other exists but nested result is empty', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          local: { key: 'value' },
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

  describe('AncestorAndOtherStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_AND_OTHER)

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
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
        })

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
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
          attribute: 'testAttr',
        })

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
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
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
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
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

  describe('AllPresentStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ALL)

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
          ancestor: { a: 'ancestorA' },
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
})
