import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type {
  MergeContext,
  RootKeyInfo,
} from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { AllPresentStrategy } from '../../../../src/merger/strategies/AllPresentStrategy.js'
import { AncestorAndLocalStrategy } from '../../../../src/merger/strategies/AncestorAndLocalStrategy.js'
import { AncestorAndOtherStrategy } from '../../../../src/merger/strategies/AncestorAndOtherStrategy.js'
import { AncestorOnlyStrategy } from '../../../../src/merger/strategies/AncestorOnlyStrategy.js'
import { LocalAndOtherStrategy } from '../../../../src/merger/strategies/LocalAndOtherStrategy.js'
import { LocalOnlyStrategy } from '../../../../src/merger/strategies/LocalOnlyStrategy.js'
import { NoneStrategy } from '../../../../src/merger/strategies/NoneStrategy.js'
import { OtherOnlyStrategy } from '../../../../src/merger/strategies/OtherOnlyStrategy.js'
import { getScenarioStrategy } from '../../../../src/merger/strategies/ScenarioStrategyFactory.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import type { JsonValue } from '../../../../src/types/jsonTypes.js'
import { MergeScenario } from '../../../../src/types/mergeScenario.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const createContext = (
  ancestor: JsonValue,
  local: JsonValue,
  other: JsonValue,
  attribute?: string,
  rootKey?: RootKeyInfo
): MergeContext => ({
  config: defaultConfig,
  ancestor,
  local,
  other,
  attribute,
  nodeFactory: defaultNodeFactory,
  rootKey,
})

describe('ScenarioStrategyFactory', () => {
  describe('getScenarioStrategy', () => {
    it.each([
      [MergeScenario.NONE, NoneStrategy],
      [MergeScenario.OTHER_ONLY, OtherOnlyStrategy],
      [MergeScenario.LOCAL_ONLY, LocalOnlyStrategy],
      [MergeScenario.LOCAL_AND_OTHER, LocalAndOtherStrategy],
      [MergeScenario.ANCESTOR_ONLY, AncestorOnlyStrategy],
      [MergeScenario.ANCESTOR_AND_OTHER, AncestorAndOtherStrategy],
      [MergeScenario.ANCESTOR_AND_LOCAL, AncestorAndLocalStrategy],
      [MergeScenario.ALL, AllPresentStrategy],
    ])('should return correct strategy for %s', (scenario, expectedClass) => {
      const strategy = getScenarioStrategy(scenario)
      expect(strategy).toBeInstanceOf(expectedClass)
    })
  })

  describe('NoneStrategy', () => {
    it('should return empty result with no conflict', () => {
      const strategy = new NoneStrategy()
      const context = createContext({}, {}, {})

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('AncestorOnlyStrategy', () => {
    it('should return empty result with no conflict', () => {
      const strategy = new AncestorOnlyStrategy()
      const context = createContext({ value: 'ancestor' }, {}, {})

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when rootKey exists in local', () => {
      const strategy = new AncestorOnlyStrategy()
      const context = createContext({ value: 'ancestor' }, {}, {}, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: false,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when rootKey exists in other', () => {
      const strategy = new AncestorOnlyStrategy()
      const context = createContext({ value: 'ancestor' }, {}, {}, undefined, {
        name: 'testKey',
        existsInLocal: false,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty result when rootKey exists in neither', () => {
      const strategy = new AncestorOnlyStrategy()
      const context = createContext({ value: 'ancestor' }, {}, {}, undefined, {
        name: 'testKey',
        existsInLocal: false,
        existsInOther: false,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalOnlyStrategy', () => {
    it('should return transformed local content', () => {
      const strategy = new LocalOnlyStrategy()
      const context = createContext({}, { key: 'localValue' }, {})

      const result = strategy.execute(context)

      expect(result.output).toHaveLength(1)
      expect(result.hasConflict).toBe(false)
    })

    it('should wrap with rootKey when rootKey is provided', () => {
      const strategy = new LocalOnlyStrategy()
      const context = createContext({}, { key: 'localValue' }, {}, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: false,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('OtherOnlyStrategy', () => {
    it('should return transformed other content', () => {
      const strategy = new OtherOnlyStrategy()
      const context = createContext({}, {}, { key: 'otherValue' })

      const result = strategy.execute(context)

      expect(result.output).toHaveLength(1)
      expect(result.hasConflict).toBe(false)
    })

    it('should wrap with rootKey when rootKey is provided', () => {
      const strategy = new OtherOnlyStrategy()
      const context = createContext({}, {}, { key: 'otherValue' }, undefined, {
        name: 'testKey',
        existsInLocal: false,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalAndOtherStrategy', () => {
    it('should return other when local and other are equal', () => {
      const strategy = new LocalAndOtherStrategy()
      const local = { key: 'sameValue' }
      const other = { key: 'sameValue' }
      const context = createContext({}, local, other)

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(false)
    })

    it('should wrap with rootKey when equal and rootKey is provided', () => {
      const strategy = new LocalAndOtherStrategy()
      const local = { key: 'sameValue' }
      const other = { key: 'sameValue' }
      const context = createContext({}, local, other, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      expect(result.hasConflict).toBe(false)
    })

    it('should merge children when local and other differ', () => {
      const strategy = new LocalAndOtherStrategy()
      const local = { a: 'localA', b: 'shared' }
      const other = { a: 'otherA', b: 'shared' }
      const context = createContext({}, local, other)

      const result = strategy.execute(context)

      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should wrap merged result with rootKey when rootKey is provided', () => {
      const strategy = new LocalAndOtherStrategy()
      const local = { a: 'localA' }
      const other = { a: 'otherA' }
      const context = createContext({}, local, other, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should return empty key when result is empty with rootKey', () => {
      const strategy = new LocalAndOtherStrategy()
      // Create a scenario where mergeChildren returns empty output
      const local = {}
      const other = {}
      const context = createContext({}, local, other, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      // When local and other are equal empty objects, toJsonArray returns []
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })

    it('should return empty key when different but mergeChildren returns empty', () => {
      const strategy = new LocalAndOtherStrategy()
      // Different objects that produce empty merge result
      // When children are all deleted/empty, mergeChildren returns empty
      const local = { a: null }
      const other = { b: null }
      const context = createContext({}, local, other, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      // Result should have the testKey with merged content or empty
      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })
  })

  describe('AncestorAndOtherStrategy', () => {
    it('should return empty when ancestor equals other', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'sameValue' },
        {},
        { key: 'sameValue' }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when ancestor and other differ', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        {},
        { key: 'otherValue' }
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should handle multi-element arrays in extractContent', () => {
      // Covers the arr.length !== 1 branch in extractContent
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { a: 'ancestorA', b: 'ancestorB' },
        {},
        { a: 'otherA', b: 'otherB' }
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should return conflict with attribute wrapping when attribute is set', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        {},
        { key: 'otherValue' },
        'testAttr'
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should return empty when rootKey local missing and other unchanged', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'value' },
        {},
        { key: 'value' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: false,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when rootKey local missing and other changed', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        {},
        { key: 'otherValue' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: false,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should wrap result with rootKey when local exists with empty value', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        {},
        { key: 'otherValue' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should return empty key when local exists but nested result is empty', () => {
      const strategy = new AncestorAndOtherStrategy()
      const context = createContext(
        { key: 'value' },
        {},
        { key: 'value' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      // ancestor equals other, so local deletion wins -> empty result
      // but key exists so return empty key
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('AncestorAndLocalStrategy', () => {
    it('should return empty when ancestor equals local', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'sameValue' },
        { key: 'sameValue' },
        {}
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when ancestor and local differ', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        { key: 'localValue' },
        {}
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should handle multi-element arrays in extractContent', () => {
      // Covers the arr.length !== 1 branch in extractContent
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { a: 'ancestorA', b: 'ancestorB' },
        { a: 'localA', b: 'localB' },
        {}
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should return conflict with attribute wrapping when attribute is set', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        { key: 'localValue' },
        {},
        'testAttr'
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should return empty when rootKey other missing and local unchanged', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'value' },
        { key: 'value' },
        {},
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: false,
        }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should return conflict when rootKey other missing and local changed', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        { key: 'localValue' },
        {},
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: false,
        }
      )

      const result = strategy.execute(context)

      expect(result.hasConflict).toBe(true)
    })

    it('should wrap result with rootKey when other exists with empty value', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'ancestorValue' },
        { key: 'localValue' },
        {},
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should return empty key when other exists but nested result is empty', () => {
      const strategy = new AncestorAndLocalStrategy()
      const context = createContext(
        { key: 'value' },
        { key: 'value' },
        {},
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      // ancestor equals local, so other deletion wins -> empty result
      // but key exists so return empty key
      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('AllPresentStrategy', () => {
    it('should merge all children', () => {
      const strategy = new AllPresentStrategy()
      const context = createContext(
        { a: 'ancestorA', b: 'ancestorB' },
        { a: 'localA', b: 'localB' },
        { a: 'otherA', b: 'otherB' }
      )

      const result = strategy.execute(context)

      expect(result.output.length).toBeGreaterThan(0)
    })

    it('should wrap result with rootKey when rootKey is provided', () => {
      const strategy = new AllPresentStrategy()
      const context = createContext(
        { a: 'ancestorA' },
        { a: 'localA' },
        { a: 'otherA' },
        undefined,
        {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        }
      )

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: expect.any(Array) }])
    })

    it('should return empty key when result is empty with rootKey', () => {
      const strategy = new AllPresentStrategy()
      // All empty objects - will produce empty output
      const context = createContext({}, {}, {}, undefined, {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      })

      const result = strategy.execute(context)

      expect(result.output).toEqual([{ testKey: [] }])
      expect(result.hasConflict).toBe(false)
    })
  })
})
