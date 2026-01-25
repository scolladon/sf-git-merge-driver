import { AllPresentStrategy } from '../../../../src/merger/strategies/AllPresentStrategy.js'
import { AncestorAndLocalStrategy } from '../../../../src/merger/strategies/AncestorAndLocalStrategy.js'
import { AncestorAndOtherStrategy } from '../../../../src/merger/strategies/AncestorAndOtherStrategy.js'
import { AncestorOnlyStrategy } from '../../../../src/merger/strategies/AncestorOnlyStrategy.js'
import { LocalAndOtherStrategy } from '../../../../src/merger/strategies/LocalAndOtherStrategy.js'
import { LocalOnlyStrategy } from '../../../../src/merger/strategies/LocalOnlyStrategy.js'
import { NoneStrategy } from '../../../../src/merger/strategies/NoneStrategy.js'
import { OtherOnlyStrategy } from '../../../../src/merger/strategies/OtherOnlyStrategy.js'
import { getScenarioStrategy } from '../../../../src/merger/strategies/ScenarioStrategyFactory.js'
import { MergeScenario } from '../../../../src/types/mergeScenario.js'

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
})
