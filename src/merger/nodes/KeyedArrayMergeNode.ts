import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { signatureOf } from '../../utils/jsonSignature.js'
import type {
  ExtractedKeys,
  KeyExtractor,
  KeyedSides,
  SideKeys,
} from './KeyedArrayIndex.js'
import { extractKeys, toSideKeys } from './KeyedArrayIndex.js'
import type { KeyedArrayMergeStrategy } from './KeyedArrayMergeStrategy.js'
import type { MergeNode } from './MergeNode.js'
import { OrderedKeyedArrayMergeStrategy } from './OrderedKeyedArrayMergeStrategy.js'
import { UnorderedKeyedArrayMergeStrategy } from './UnorderedKeyedArrayMergeStrategy.js'

// ============================================================================
// KeyedArrayMergeNode
// ============================================================================

type SideTrio<T> = readonly [ancestor: T, local: T, other: T]

// A keyless entry is identified by its content signature, a keyed one by its
// key. Both live in one key space, so keyed ones are namespaced: a signature
// is JSON text and never starts with "key:", while a bare real key could be
// spelled exactly like some entry's signature and be read as that entry.
const KEY_NAMESPACE = 'key:'

const identityKeys = (
  side: JsonArray,
  extracted: ExtractedKeys | undefined
): SideKeys =>
  side.map((entry, index) => {
    const key = extracted?.[index]
    return key === undefined
      ? signatureOf(entry as JsonObject)
      : `${KEY_NAMESPACE}${key}`
  })

const keyedSides = (
  extracted: SideTrio<ExtractedKeys>
): KeyedSides | undefined => {
  const [ancestor, local, other] = extracted.map(toSideKeys)
  return ancestor && local && other ? { ancestor, local, other } : undefined
}

export class KeyedArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string,
    private readonly keyField: KeyExtractor | undefined,
    private readonly isOrdered: boolean
  ) {}

  merge(config: MergeConfig): MergeResult {
    const extracted = this.extractSideKeys()
    const keys = extracted && keyedSides(extracted)
    if (keys === undefined) {
      return this.keylessStrategy(extracted).merge(config)
    }
    return this.keyedStrategy(keys).merge(config)
  }

  // Read once per side: the routing and the chosen strategy both work from
  // these keys, so the extractor runs once per entry.
  private extractSideKeys(): SideTrio<ExtractedKeys> | undefined {
    const keyOf = this.keyField
    if (keyOf === undefined) return undefined
    return [
      extractKeys(this.ancestor, keyOf),
      extractKeys(this.local, keyOf),
      extractKeys(this.other, keyOf),
    ]
  }

  private keylessStrategy(
    extracted: SideTrio<ExtractedKeys> | undefined
  ): KeyedArrayMergeStrategy {
    return new OrderedKeyedArrayMergeStrategy(
      this.ancestor,
      this.local,
      this.other,
      this.attribute,
      {
        ancestor: identityKeys(this.ancestor, extracted?.[0]),
        local: identityKeys(this.local, extracted?.[1]),
        other: identityKeys(this.other, extracted?.[2]),
      }
    )
  }

  private keyedStrategy(keys: KeyedSides): KeyedArrayMergeStrategy {
    const StrategyType = this.isOrdered
      ? OrderedKeyedArrayMergeStrategy
      : UnorderedKeyedArrayMergeStrategy
    return new StrategyType(
      this.ancestor,
      this.local,
      this.other,
      this.attribute,
      keys
    )
  }
}
