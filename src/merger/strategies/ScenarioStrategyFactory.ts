import { MergeScenario } from '../../types/mergeScenario.js'
import { AllPresentStrategy } from './AllPresentStrategy.js'
import { AncestorAndLocalStrategy } from './AncestorAndLocalStrategy.js'
import { AncestorAndOtherStrategy } from './AncestorAndOtherStrategy.js'
import { AncestorOnlyStrategy } from './AncestorOnlyStrategy.js'
import { LocalAndOtherStrategy } from './LocalAndOtherStrategy.js'
import { LocalOnlyStrategy } from './LocalOnlyStrategy.js'
import { NoneStrategy } from './NoneStrategy.js'
import { OtherOnlyStrategy } from './OtherOnlyStrategy.js'
import type { ScenarioStrategy } from './ScenarioStrategy.js'

const strategies: Record<MergeScenario, ScenarioStrategy> = {
  [MergeScenario.NONE]: new NoneStrategy(),
  [MergeScenario.OTHER_ONLY]: new OtherOnlyStrategy(),
  [MergeScenario.LOCAL_ONLY]: new LocalOnlyStrategy(),
  [MergeScenario.LOCAL_AND_OTHER]: new LocalAndOtherStrategy(),
  [MergeScenario.ANCESTOR_ONLY]: new AncestorOnlyStrategy(),
  [MergeScenario.ANCESTOR_AND_OTHER]: new AncestorAndOtherStrategy(),
  [MergeScenario.ANCESTOR_AND_LOCAL]: new AncestorAndLocalStrategy(),
  [MergeScenario.ALL]: new AllPresentStrategy(),
}

export const getScenarioStrategy = (
  scenario: MergeScenario
): ScenarioStrategy => {
  return strategies[scenario]
}
