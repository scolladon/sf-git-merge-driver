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
  readonly ancestor: JsonValue
  readonly local: JsonValue
  readonly other: JsonValue
  readonly attribute: string | undefined
  readonly nodeFactory: MergeNodeFactory
  readonly rootKey: RootKeyInfo | undefined
}
