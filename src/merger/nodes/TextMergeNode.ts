import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { getScenario } from '../MergeScenarioFactory.js'
import { getTextMergeStrategy } from '../strategies/TextMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'

const toObj = (
  value: JsonValue | null | undefined,
  attrib: string
): JsonObject => (value == null ? {} : { [attrib]: value })

export class TextMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonValue | null | undefined,
    private readonly local: JsonValue | null | undefined,
    private readonly other: JsonValue | null | undefined,
    private readonly attribute: string
  ) {}

  merge(config: MergeConfig): MergeResult {
    const objAncestor = toObj(this.ancestor, this.attribute)
    const objLocal = toObj(this.local, this.attribute)
    const objOther = toObj(this.other, this.attribute)

    const scenario = getScenario(objAncestor, objLocal, objOther)
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
