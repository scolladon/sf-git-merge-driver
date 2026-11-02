import type { MergeConfig } from '../types/conflictTypes.js'
import {
  type JsonArray,
  type JsonObject,
  type JsonValue,
  toJsonObjectOrEmpty,
} from '../types/jsonTypes.js'
import { combineResults, type MergeResult } from '../types/mergeResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MergeOrchestrator } from './MergeOrchestrator.js'
import { defaultNodeFactory } from './nodes/MergeNodeFactory.js'
import { TextMergeNode } from './nodes/TextMergeNode.js'
import { isSingleValueTrio } from './nodes/valueKind.js'
import { ContestedTagOrder } from './tagOrder/contestedTagOrder.js'
import { mergePropertyOrder } from './tagOrder/mergePropertyOrder.js'
import { mergeTagsInOrder } from './tagOrder/propertyOrderConflict.js'

// `obj[key]` also walks the prototype chain (e.g. `{}['constructor']`
// resolves to the inherited Object constructor) — key is an untrusted
// XML tag name, so an own-property guard is needed here too, not just
// on the `in` check below.
const getOwnProperty = (obj: JsonObject, key: string): JsonValue | undefined =>
  Object.hasOwn(obj, key) ? obj[key] : undefined

// An emptied root (`<Root/>`) is a file whose entries all went away, not a
// text body: it keeps merging entry by entry against the other side's edits.
const EMPTIED_ROOT = ''

const asRootBody = (value: JsonValue | undefined): JsonValue | undefined =>
  value === EMPTIED_ROOT ? undefined : value

interface RootDocuments {
  readonly ancestor: JsonObject
  readonly local: JsonObject
  readonly other: JsonObject
}

type Trio = readonly [
  JsonValue | undefined,
  JsonValue | undefined,
  JsonValue | undefined,
]

// The kind of a body is read with an emptied root as absent, while a merge of
// the whole value renders the sides as they are: an emptied side is `<Root/>`.
const rootSidesOf = (
  key: string,
  { ancestor, local, other }: RootDocuments
): { originals: Trio; bodies: Trio } => {
  const originals: Trio = [
    getOwnProperty(ancestor, key),
    getOwnProperty(local, key),
    getOwnProperty(other, key),
  ]
  const bodies: Trio = [
    asRootBody(originals[0]),
    asRootBody(originals[1]),
    asRootBody(originals[2]),
  ]
  return { originals, bodies }
}

export class JsonMerger {
  private readonly orchestrator: MergeOrchestrator

  // The tags this merges are the document's, which is the root element and
  // nothing else; the orchestrator merges that root element, so its children
  // are the ones with a canonical order. Every element below it, reached
  // through a node, merges with the default: conflict.
  constructor(private readonly config: MergeConfig) {
    this.orchestrator = new MergeOrchestrator(
      config,
      defaultNodeFactory,
      ContestedTagOrder.CANONICAL
    )
  }

  @log('JsonMerger')
  public mergeThreeWay(
    ancestor: JsonObject | JsonArray,
    local: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): { output: JsonArray; hasConflict: boolean } {
    // Narrow once up front so the per-key loop can index directly without
    // paying for Array.isArray on every property access (hot path —
    // observed >20% cost on ordered-merge benches).
    const ancestorObj = toJsonObjectOrEmpty(ancestor)
    const localObj = toJsonObjectOrEmpty(local)
    const otherObj = toJsonObjectOrEmpty(other)

    const merged = mergePropertyOrder(ancestor, local, other)
    const sides = { ancestor: ancestorObj, local: localObj, other: otherObj }
    const results = mergeTagsInOrder(merged, sides, key =>
      this.mergeRoot(key, sides)
    )

    const combined = combineResults(results)
    return {
      output: combined.output,
      hasConflict: combined.hasConflict,
    }
  }

  // A root body that is a whole value, as at any other tag, is not merged
  // child by child: its text would be dropped.
  private mergeRoot(key: string, sides: RootDocuments): MergeResult {
    const { originals, bodies } = rootSidesOf(key, sides)
    if (isSingleValueTrio(...bodies, key)) {
      return new TextMergeNode(...originals, key).merge(this.config)
    }
    return this.orchestrator.merge(...originals, {
      name: key,
      existsInLocal: Object.hasOwn(sides.local, key),
      existsInOther: Object.hasOwn(sides.other, key),
    })
  }
}
