import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import { getTextMergeStrategy } from '../../../../src/merger/strategies/TextMergeStrategy.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'
import { MergeScenario } from '../../../../src/types/mergeScenario.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('TextMergeStrategy', () => {
  describe('getTextMergeStrategy', () => {
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
      const strategy = getTextMergeStrategy(scenario)

      // Assert
      expect(strategy).toBeDefined()
      expect(strategy.handle).toBeDefined()
    })
  })

  describe('NoneStrategy', () => {
    it('should return empty result with no conflict', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.NONE)

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal: {},
        objOther: {},
        ancestor: null,
        local: null,
        other: null,
      })

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('OtherOnlyStrategy', () => {
    it('should return other value with no conflict', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.OTHER_ONLY)
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal: {},
        objOther,
        ancestor: null,
        local: null,
        other: 'otherValue',
      })

      // Assert
      expect(result.output).toEqual([objOther])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalOnlyStrategy', () => {
    it('should return local value with no conflict', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.LOCAL_ONLY)
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal,
        objOther: {},
        ancestor: null,
        local: 'localValue',
        other: null,
      })

      // Assert
      expect(result.output).toEqual([objLocal])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('AncestorOnlyStrategy', () => {
    it('should return empty result with no conflict', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ANCESTOR_ONLY)

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal: {},
        objOther: {},
        ancestor: null,
        local: null,
        other: null,
      })

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalAndOtherStrategy', () => {
    it('should return conflict markers when local and other differ', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.LOCAL_AND_OTHER)
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal,
        objOther,
        ancestor: null,
        local: 'localValue',
        other: 'otherValue',
      })

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return no conflict when local and other are equal', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.LOCAL_AND_OTHER)
      const objLocal = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor: {},
        objLocal,
        objOther,
        ancestor: null,
        local: 'sameValue',
        other: 'sameValue',
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })
  })

  describe('AncestorAndOtherStrategy', () => {
    it('should return conflict when ancestor and other differ', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ANCESTOR_AND_OTHER)
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal: {},
        objOther,
        ancestor: 'ancestor',
        local: null,
        other: 'other',
      })

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return empty result when ancestor equals other', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ANCESTOR_AND_OTHER)
      const objAncestor = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal: {},
        objOther,
        ancestor: 'sameValue',
        local: null,
        other: 'sameValue',
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })
  })

  describe('AncestorAndLocalStrategy', () => {
    it('should return conflict when ancestor and local differ', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther: {},
        ancestor: 'ancestor',
        local: 'local',
        other: null,
      })

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return empty result when ancestor equals local', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther: {},
        ancestor: 'sameValue',
        local: 'sameValue',
        other: null,
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })
  })

  describe('AllPresentStrategy', () => {
    it('should return other when ancestor equals local', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ALL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        ancestor: 'ancestorValue',
        local: 'ancestorValue',
        other: 'otherValue',
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objOther])
    })

    it('should return local when ancestor equals other', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ALL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        ancestor: 'ancestorValue',
        local: 'localValue',
        other: 'ancestorValue',
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })

    it('should return conflict when all three differ', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ALL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        ancestor: 'ancestorValue',
        local: 'localValue',
        other: 'otherValue',
      })

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return local when both local and other changed to same value', () => {
      // Arrange
      const strategy = getTextMergeStrategy(MergeScenario.ALL)
      const objAncestor = { field: [{ [TEXT_TAG]: 'originalValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'newValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'newValue' }] }

      // Act
      const result = strategy.handle({
        config: defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        ancestor: 'originalValue',
        local: 'newValue',
        other: 'newValue',
      })

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })
  })
})
