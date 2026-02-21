import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { getScenario } from '../MergeScenarioFactory.js'
import { getTextMergeStrategy } from '../strategies/TextMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'
import { generateObj } from './nodeUtils.js'

export class TextMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonValue | null,
    private readonly local: JsonValue | null,
    private readonly other: JsonValue | null,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const objAncestor = generateObj(this.ancestor, this.attribute)
    const objLocal = generateObj(this.local, this.attribute)
    const objOther = generateObj(this.other, this.attribute)

    const scenario = getScenario(objAncestor, objLocal, objOther)

    if (
      this.local === this.other &&
      (scenario === MergeScenario.LOCAL_AND_OTHER ||
        scenario === MergeScenario.ALL)
    ) {
      return noConflict([objLocal])
    }

    const strategy = getTextMergeStrategy(scenario)
    return strategy.handle({
      config,
      objAncestor,
      objLocal,
      objOther,
      ancestor: this.ancestor,
      local: this.local,
      other: this.other,
    })
  }
}
