import type { RootAttributeSides } from '../adapter/XmlSerializer.js'
import type { JsonObject, JsonValue } from '../types/jsonTypes.js'

// Every root attribute — the xmlns* declarations and any other, such as
// `xsi:schemaLocation` — lives in a bucket parsed separately from `content`
// (see scanDocument's bucketRootAttrs) and never reaches MergeOrchestrator,
// so it needs its own three-way resolution. Attributes follow the doctrines of
// fields: per key, a one-sided change is kept, the same change on both sides
// is kept once, and attributes the sides changed apart merge. Different
// changes of one attribute, or a deletion against an edit, are contested.
export interface MergedRootAttributes {
  readonly attributes: JsonObject
  readonly contested?: RootAttributeSides
}

type Value = JsonValue | undefined

const isContested = (ancestor: Value, local: Value, other: Value): boolean =>
  ancestor !== local && ancestor !== other && local !== other

// A contested key holds local's value here: the start tag of local's side
const settledValue = (ancestor: Value, local: Value, other: Value): Value =>
  ancestor === local ? other : local

const only = (entries: readonly (readonly [string, Value])[]): JsonObject =>
  Object.fromEntries(
    entries.filter(([, value]) => value !== undefined)
  ) as JsonObject

const keysOf = (...buckets: readonly JsonObject[]): string[] => [
  ...new Set(buckets.flatMap(bucket => Object.keys(bucket))),
]

const settledAttributes = (
  keys: readonly string[],
  [ancestor, local, other]: readonly JsonObject[]
): JsonObject =>
  only(
    keys.map(key => [
      key,
      settledValue(ancestor![key], local![key], other![key]),
    ])
  )

// Other's start tag: its own value where the attribute is contested
const otherSideAttributes = (
  keys: readonly string[],
  contested: ReadonlySet<string>,
  [ancestor, local, other]: readonly JsonObject[]
): JsonObject =>
  only(
    keys.map(key => [
      key,
      contested.has(key)
        ? other![key]
        : settledValue(ancestor![key], local![key], other![key]),
    ])
  )

const contestedKeys = (
  keys: readonly string[],
  [ancestor, local, other]: readonly JsonObject[]
): ReadonlySet<string> =>
  new Set(
    keys.filter(key => isContested(ancestor![key], local![key], other![key]))
  )

export const mergeRootAttributes = (
  ancestor: JsonObject,
  local: JsonObject,
  other: JsonObject
): MergedRootAttributes => {
  const buckets = [ancestor, local, other]
  const keys = keysOf(...buckets)
  const contested = contestedKeys(keys, buckets)
  const attributes = settledAttributes(keys, buckets)
  if (contested.size === 0) return { attributes }
  return {
    attributes,
    contested: {
      local: attributes,
      ancestor,
      other: otherSideAttributes(keys, contested, buckets),
    },
  }
}
