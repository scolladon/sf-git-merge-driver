import { describe, expect, it } from 'vitest'
import {
  getScalarScenario,
  getScenario,
} from '../../../src/merger/MergeScenarioFactory.js'
import type { JsonValue } from '../../../src/types/jsonTypes.js'
import { MergeScenario } from '../../../src/types/mergeScenario.js'

describe('MergeScenarioFactory', () => {
  describe('getScenario', () => {
    it('should return NONE when all inputs are empty', () => {
      // Assert
      expect(getScenario({}, {}, {})).toBe(MergeScenario.NONE)
      expect(getScenario(null, null, null)).toBe(MergeScenario.NONE)
      expect(getScenario([], [], [])).toBe(MergeScenario.NONE)
      expect(getScenario('', '', '')).toBe(MergeScenario.NONE)
    })

    it('given string values when present then treats as content', () => {
      // Assert
      expect(getScenario('text', {}, {})).toBe(MergeScenario.ANCESTOR_ONLY)
      expect(getScenario({}, 'text', {})).toBe(MergeScenario.LOCAL_ONLY)
      expect(getScenario({}, {}, 'text')).toBe(MergeScenario.OTHER_ONLY)
    })

    it('given numeric values when present then treats as content', () => {
      // Assert
      expect(getScenario(42 as unknown as JsonValue, {}, {})).toBe(
        MergeScenario.ANCESTOR_ONLY
      )
    })

    it('should return OTHER_ONLY when only other has content', () => {
      // Assert
      expect(getScenario({}, {}, { key: 'value' })).toBe(
        MergeScenario.OTHER_ONLY
      )
      expect(getScenario(null, null, { key: 'value' })).toBe(
        MergeScenario.OTHER_ONLY
      )
      expect(getScenario([], [], [1])).toBe(MergeScenario.OTHER_ONLY)
    })

    it('should return LOCAL_ONLY when only local has content', () => {
      // Assert
      expect(getScenario({}, { key: 'value' }, {})).toBe(
        MergeScenario.LOCAL_ONLY
      )
      expect(getScenario(null, { key: 'value' }, null)).toBe(
        MergeScenario.LOCAL_ONLY
      )
      expect(getScenario([], [1], [])).toBe(MergeScenario.LOCAL_ONLY)
    })

    it('should return LOCAL_AND_OTHER when local and other have content', () => {
      // Assert
      expect(getScenario({}, { key: 'local' }, { key: 'other' })).toBe(
        MergeScenario.LOCAL_AND_OTHER
      )
      expect(getScenario(null, [1], [2])).toBe(MergeScenario.LOCAL_AND_OTHER)
    })

    it('should return ANCESTOR_ONLY when only ancestor has content', () => {
      // Assert
      expect(getScenario({ key: 'value' }, {}, {})).toBe(
        MergeScenario.ANCESTOR_ONLY
      )
      expect(getScenario([1], [], [])).toBe(MergeScenario.ANCESTOR_ONLY)
    })

    it('should return ANCESTOR_AND_OTHER when ancestor and other have content', () => {
      // Assert
      expect(getScenario({ key: 'ancestor' }, {}, { key: 'other' })).toBe(
        MergeScenario.ANCESTOR_AND_OTHER
      )
      expect(getScenario([1], [], [2])).toBe(MergeScenario.ANCESTOR_AND_OTHER)
    })

    it('should return ANCESTOR_AND_LOCAL when ancestor and local have content', () => {
      // Assert
      expect(getScenario({ key: 'ancestor' }, { key: 'local' }, {})).toBe(
        MergeScenario.ANCESTOR_AND_LOCAL
      )
      expect(getScenario([1], [2], [])).toBe(MergeScenario.ANCESTOR_AND_LOCAL)
    })

    it('should return ALL when all three have content', () => {
      // Assert
      expect(
        getScenario({ key: 'ancestor' }, { key: 'local' }, { key: 'other' })
      ).toBe(MergeScenario.ALL)
      expect(getScenario([1], [2], [3])).toBe(MergeScenario.ALL)
    })
  })

  describe('getScalarScenario', () => {
    it('given null and undefined sides when getScalarScenario then returns NONE', () => {
      // Assert
      expect(getScalarScenario(null, undefined, null)).toBe(MergeScenario.NONE)
    })

    it('given an empty string on other when getScalarScenario then returns OTHER_ONLY', () => {
      // Assert
      expect(getScalarScenario(null, undefined, '')).toBe(
        MergeScenario.OTHER_ONLY
      )
    })

    it('given zero on local when getScalarScenario then returns LOCAL_ONLY', () => {
      // Assert
      expect(getScalarScenario(undefined, 0, null)).toBe(
        MergeScenario.LOCAL_ONLY
      )
    })

    it('given false on local and text on other when getScalarScenario then returns LOCAL_AND_OTHER', () => {
      // Assert
      expect(getScalarScenario(null, false, 'other')).toBe(
        MergeScenario.LOCAL_AND_OTHER
      )
    })

    it('given text on ancestor only when getScalarScenario then returns ANCESTOR_ONLY', () => {
      // Assert
      expect(getScalarScenario('ancestor', null, undefined)).toBe(
        MergeScenario.ANCESTOR_ONLY
      )
    })

    it('given text on ancestor and other when getScalarScenario then returns ANCESTOR_AND_OTHER', () => {
      // Assert
      expect(getScalarScenario('ancestor', null, 'other')).toBe(
        MergeScenario.ANCESTOR_AND_OTHER
      )
    })

    it('given text on ancestor and local when getScalarScenario then returns ANCESTOR_AND_LOCAL', () => {
      // Assert
      expect(getScalarScenario('ancestor', 'local', undefined)).toBe(
        MergeScenario.ANCESTOR_AND_LOCAL
      )
    })

    it('given text on all three sides when getScalarScenario then returns ALL', () => {
      // Assert
      expect(getScalarScenario('ancestor', 'local', 'other')).toBe(
        MergeScenario.ALL
      )
    })
  })
})
