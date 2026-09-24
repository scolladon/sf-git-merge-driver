import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { getScalarScenario } from '../MergeScenarioFactory.js'
import { getTextMergeStrategy } from '../strategies/TextMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'

export class TextMergeNode implements MergeNode {
  constructor(
    // `null` is already in JsonValue; `undefined` distinguishes the
    // "key not present on this side" case propagated from JsonMerger/
    // ScenarioStrategy via getJsonProp/toJsonObjectOrEmpty + direct indexing.
    private readonly ancestor: JsonValue | undefined,
    private readonly local: JsonValue | undefined,
    private readonly other: JsonValue | undefined,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const scenario = getScalarScenario(this.ancestor, this.local, this.other)
    const strategy = getTextMergeStrategy(scenario)
    return strategy.handle({
      config,
      attribute: this.attribute,
      ancestor: this.ancestor,
      local: this.local,
      other: this.other,
    })
  }
}
