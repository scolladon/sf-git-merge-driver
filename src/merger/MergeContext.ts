import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonValue } from '../types/jsonTypes.js'
import type { MergeNodeFactory } from './nodes/MergeNodeFactory.js'

export interface RootKeyInfo {
  readonly name: string
  readonly existsInLocal: boolean
  readonly existsInOther: boolean
}

export interface MergeContext {
  readonly config: MergeConfig
  // Undefined distinguishes "key not present on this side" from JsonValue null.
  // Downstream `isPresent()` treats both as absent, but the type preserves the
  // distinction for strategies that inspect existence separately.
  readonly ancestor: JsonValue | undefined
  readonly local: JsonValue | undefined
  readonly other: JsonValue | undefined
  readonly attribute: string | undefined
  readonly nodeFactory: MergeNodeFactory
  readonly rootKey: RootKeyInfo | undefined
}
