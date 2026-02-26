import { getScenario } from '../../../src/merger/MergeScenarioFactory.js'
import { MergeScenario } from '../../../src/types/mergeScenario.js'

describe('MergeScenarioFactory', () => {
  describe('getScenario', () => {
    it('should return NONE when all inputs are empty', () => {
      // Assert
      expect(getScenario({}, {}, {})).toBe(MergeScenario.NONE)
      expect(getScenario(null, null, null)).toBe(MergeScenario.NONE)
      expect(getScenario([], [], [])).toBe(MergeScenario.NONE)
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
})
