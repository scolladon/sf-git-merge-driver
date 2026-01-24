import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import { TEXT_TAG } from '../../../../src/constant/parserConstant.js'
import {
  AllPresentStrategy,
  AncestorAndLocalStrategy,
  AncestorAndOtherStrategy,
  AncestorOnlyStrategy,
  getTextMergeStrategy,
  LocalAndOtherStrategy,
  LocalOnlyStrategy,
  NoneStrategy,
  OtherOnlyStrategy,
} from '../../../../src/merger/strategies/TextMergeStrategy.js'
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
      [MergeScenario.NONE, NoneStrategy],
      [MergeScenario.OTHER_ONLY, OtherOnlyStrategy],
      [MergeScenario.LOCAL_ONLY, LocalOnlyStrategy],
      [MergeScenario.LOCAL_AND_OTHER, LocalAndOtherStrategy],
      [MergeScenario.ANCESTOR_ONLY, AncestorOnlyStrategy],
      [MergeScenario.ANCESTOR_AND_OTHER, AncestorAndOtherStrategy],
      [MergeScenario.ANCESTOR_AND_LOCAL, AncestorAndLocalStrategy],
      [MergeScenario.ALL, AllPresentStrategy],
    ])('should return correct strategy for %s', (scenario, expectedClass) => {
      // Act
      const strategy = getTextMergeStrategy(scenario)

      // Assert
      expect(strategy).toBeInstanceOf(expectedClass)
    })
  })

  describe('NoneStrategy', () => {
    it('should return empty result with no conflict', () => {
      // Arrange
      const strategy = new NoneStrategy()

      // Act
      const result = strategy.handle()

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('OtherOnlyStrategy', () => {
    it('should return other value with no conflict', () => {
      // Arrange
      const strategy = new OtherOnlyStrategy()
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle(defaultConfig, {}, {}, objOther)

      // Assert
      expect(result.output).toEqual([objOther])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalOnlyStrategy', () => {
    it('should return local value with no conflict', () => {
      // Arrange
      const strategy = new LocalOnlyStrategy()
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }

      // Act
      const result = strategy.handle(defaultConfig, {}, objLocal)

      // Assert
      expect(result.output).toEqual([objLocal])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('AncestorOnlyStrategy', () => {
    it('should return empty result with no conflict', () => {
      // Arrange
      const strategy = new AncestorOnlyStrategy()

      // Act
      const result = strategy.handle()

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('LocalAndOtherStrategy', () => {
    it('should return conflict markers when local and other differ', () => {
      // Arrange
      const strategy = new LocalAndOtherStrategy()
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        {},
        objLocal,
        objOther,
        null,
        'localValue',
        'otherValue'
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7) // conflict markers structure
    })

    it('should return no conflict when local and other are equal', () => {
      // Arrange
      const strategy = new LocalAndOtherStrategy()
      const objLocal = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        {},
        objLocal,
        objOther,
        null,
        'sameValue',
        'sameValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })
  })

  describe('AncestorAndOtherStrategy', () => {
    it('should return conflict when ancestor and other differ', () => {
      // Arrange
      const strategy = new AncestorAndOtherStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        {},
        objOther,
        'ancestor',
        null,
        'other'
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return empty result when ancestor equals other', () => {
      // Arrange
      const strategy = new AncestorAndOtherStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        {},
        objOther,
        'sameValue',
        null,
        'sameValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })
  })

  describe('AncestorAndLocalStrategy', () => {
    it('should return conflict when ancestor and local differ', () => {
      // Arrange
      const strategy = new AncestorAndLocalStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        {},
        'ancestor',
        'local'
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return empty result when ancestor equals local', () => {
      // Arrange
      const strategy = new AncestorAndLocalStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'sameValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'sameValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        {},
        'sameValue',
        'sameValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([])
    })
  })

  describe('AllPresentStrategy', () => {
    it('should return other when ancestor equals local', () => {
      // Arrange
      const strategy = new AllPresentStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        'ancestorValue',
        'ancestorValue',
        'otherValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objOther])
    })

    it('should return local when ancestor equals other', () => {
      // Arrange
      const strategy = new AllPresentStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        'ancestorValue',
        'localValue',
        'ancestorValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })

    it('should return conflict when all three differ', () => {
      // Arrange
      const strategy = new AllPresentStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        'ancestorValue',
        'localValue',
        'otherValue'
      )

      // Assert
      expect(result.hasConflict).toBe(true)
      expect(result.output).toHaveLength(7)
    })

    it('should return local when both local and other changed to same value', () => {
      // Arrange - covers line 116: both changed to same value
      const strategy = new AllPresentStrategy()
      const objAncestor = { field: [{ [TEXT_TAG]: 'originalValue' }] }
      const objLocal = { field: [{ [TEXT_TAG]: 'newValue' }] }
      const objOther = { field: [{ [TEXT_TAG]: 'newValue' }] }

      // Act
      const result = strategy.handle(
        defaultConfig,
        objAncestor,
        objLocal,
        objOther,
        'originalValue',
        'newValue',
        'newValue'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toEqual([objLocal])
    })
  })
})
