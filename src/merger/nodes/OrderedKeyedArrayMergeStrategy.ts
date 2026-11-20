import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import type { KeyedSides } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'
import { mergeOrderedArrays } from './ordered/mergeOrdered.js'

export class OrderedKeyedArrayMergeStrategy implements KeyedArrayMergeStrategy {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keys: KeyedSides
  ) {}

  merge(config: MergeConfig): MergeResult {
    return mergeOrderedArrays(
      {
        ancestor: this.ancestor,
        local: this.local,
        other: this.other,
        keys: this.keys,
      },
      this.attribute,
      config
    )
  }
}
