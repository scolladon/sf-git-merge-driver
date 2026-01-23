import { deepEqual } from 'fast-equals'
import { isNil } from 'lodash-es'
import { TEXT_TAG } from '../../constant/parserConstant.js'
import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict } from '../../types/mergeResult.js'
import { getScenario, MergeScenario } from '../../types/mergeScenario.js'
import { getTextMergeStrategy } from '../strategies/TextMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'

const generateObj = (value: JsonValue | null, attrib: string): JsonObject => {
  return isNil(value) ? {} : { [attrib]: [{ [TEXT_TAG]: value }] }
}

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

    // Early return for identical values
    if (
      deepEqual(this.local, this.other) &&
      (scenario === MergeScenario.LOCAL_AND_OTHER ||
        scenario === MergeScenario.ALL)
    ) {
      return noConflict([objLocal])
    }

    const strategy = getTextMergeStrategy(scenario)
    return strategy.handle(
      config,
      objAncestor,
      objLocal,
      objOther,
      this.ancestor,
      this.local,
      this.other
    )
  }
}
