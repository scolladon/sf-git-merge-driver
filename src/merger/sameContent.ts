import { MetadataService } from '../service/MetadataService.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import {
  isChildKey,
  jsonIdenticalUpToAttributeOrder,
} from '../utils/jsonEqual.js'
import { signatureOf } from '../utils/jsonSignature.js'

type Side = JsonValue | undefined

const isPlainObject = (value: Side): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Entries of the same bucket are candidates for one another; the bucket is the
// entry's key, or its typed value for text items.
type BucketOf = (item: JsonValue) => string

const keyBucket = (attribute: string): BucketOf => {
  const keyOf = MetadataService.getKeyFieldExtractor(attribute)
  // Stryker disable next-line OptionalChaining: only built once isKeyedUnordered saw a key extractor
  return item => String(keyOf?.(item))
}

// Stryker disable next-line StringLiteral,ArrowFunction: the buckets only narrow the candidates, pairsOff settles each bucket exactly: text items have no attributes to reorder, so one signature each and a lone item is compared whole
const textBucket: BucketOf = item => `${typeof item}${JSON.stringify(item)}`

const isTextItems = (attribute: string, sides: readonly JsonArray[]): boolean =>
  // Stryker disable next-line MethodExpression: some side for every side is equivalent, as arrays of one length that read alike are all strings or none is, and otherwise every route says they differ (the same line holds the inner every, pinned by the test of a string beside an element)
  sides.some(side => side.every(item => typeof item === 'string')) ||
  (MetadataService.isTextArrayAttribute(attribute) &&
    // Stryker disable next-line MethodExpression: some side for every side is equivalent, as an element on one side only makes the arrays differ on every route (the same line holds the inner some, pinned by the test of an element beside a string)
    !sides.some(side => side.some(item => typeof item === 'object')))

const isKeyedUnordered = (
  attribute: string,
  sides: readonly JsonArray[]
): boolean => {
  const keyOf = MetadataService.getKeyFieldExtractor(attribute)
  return (
    keyOf !== undefined &&
    // Stryker disable next-line MethodExpression: some side for every side is equivalent, as arrays that hold the same entries agree on whether every entry has a key and otherwise the keyed route finds a missing bucket or entries that differ (the same line holds the inner every, pinned by the test of an entry with no key)
    sides.every(side => side.every(item => keyOf(item) !== undefined)) &&
    !MetadataService.isOrderedAttribute(attribute, sides)
  )
}

const bucketing = (
  attribute: string,
  sides: readonly JsonArray[]
): BucketOf | undefined => {
  if (isTextItems(attribute, sides)) return textBucket
  return isKeyedUnordered(attribute, sides) ? keyBucket(attribute) : undefined
}

const groupBy = (items: JsonArray, bucketOf: BucketOf) => {
  const groups = new Map<string, JsonValue[]>()
  for (const item of items) {
    const id = bucketOf(item)
    const group = groups.get(id)
    if (group === undefined) groups.set(id, [item])
    else group.push(item)
  }
  return groups
}

// Two values of the same content share a signature, whatever the order of
// their unordered arrays: exact matches cancel in linear time instead of being
// searched for pairwise. The order of an element's child tags is content: a
// reorder is a change.
const signatureOfContent = (value: JsonValue): string =>
  isPlainObject(value) ? signatureOfObject(value) : signatureOf(value)

// Stryker disable StringLiteral: the separators of the pairs are equivalent, as each pair is a quoted key, a colon and a self-delimiting signature, so the pairs read back uniquely without them (the whole template is pinned by every test of a copy that differs)
const signatureOfObject = (value: JsonObject): string =>
  `{${Object.keys(value)
    .map(key => `${JSON.stringify(key)}:${signatureUnder(key, value[key])}`)
    .join(',')}}`
// Stryker restore StringLiteral

const signatureUnder = (attribute: string, value: JsonValue): string => {
  if (!Array.isArray(value)) return signatureOfContent(value)
  const signatures = value.map(signatureOfContent)
  return bucketing(attribute, [value]) === undefined
    ? `P[${signatures.join(',')}]`
    : `M[${signatures.sort().join(',')}]`
}

// Same-content values share a signature, so the multisets match exactly when
// every signature of one side is cancelled by one of the other.
const cancelOut = (left: JsonValue[], right: JsonValue[]): boolean => {
  const free = new Map<string, number>()
  for (const item of right) {
    const signature = signatureOfContent(item)
    free.set(signature, (free.get(signature) ?? 0) + 1)
  }
  return left.every(item => {
    const signature = signatureOfContent(item)
    const remaining = free.get(signature) ?? 0
    free.set(signature, remaining - 1)
    return remaining > 0
  })
}

const pairsOff = (left: JsonValue[], right: JsonValue[]): boolean =>
  left.length === 1 ? sameValue(left[0], right[0]) : cancelOut(left, right)

const sameMultiset = (
  left: JsonArray,
  right: JsonArray,
  bucketOf: BucketOf
): boolean => {
  const [leftGroups, rightGroups] = [left, right].map(items =>
    groupBy(items, bucketOf)
  )
  return (
    // Stryker disable next-line ConditionalExpression: the arrays are as long (sameArrays) and every left group has a counterpart of its size, so the right groups hold the same entries and no more
    leftGroups.size === rightGroups.size &&
    [...leftGroups].every(([id, items]) => {
      const counterpart = rightGroups.get(id)
      return (
        counterpart !== undefined &&
        // Stryker disable next-line ConditionalExpression: a group the right holds more of leaves another the left holds more of (same total), and more copies than the right has cannot cancel out
        counterpart.length === items.length &&
        pairsOff(items, counterpart)
      )
    })
  )
}

const sameArrays = (
  attribute: string,
  left: JsonArray,
  right: JsonArray
): boolean => {
  if (left.length !== right.length) return false
  const bucketOf = bucketing(attribute, [left, right])
  if (bucketOf !== undefined) return sameMultiset(left, right, bucketOf)
  return left.every((item, index) => sameValue(item, right[index]))
}

const sameUnder = (attribute: string, left: Side, right: Side): boolean => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return sameArrays(attribute, left, right)
  }
  return sameValue(left, right)
}

const sameChildOrder = (left: string[], right: string[]): boolean =>
  left.every((key, index) => key === right[index])

// An element's attributes are a set, its child tags a sequence
const sameObjects = (left: JsonObject, right: JsonObject): boolean => {
  const keys = Object.keys(left)
  const rightKeys = Object.keys(right)
  const children = keys.filter(isChildKey)
  return (
    keys.length === rightKeys.length &&
    sameChildOrder(children, rightKeys.filter(isChildKey)) &&
    keys.every(
      key => Object.hasOwn(right, key) && sameUnder(key, left[key], right[key])
    )
  )
}

function sameValue(left: Side, right: Side): boolean {
  if (jsonIdenticalUpToAttributeOrder(left, right)) return true
  return isPlainObject(left) && isPlainObject(right) && sameObjects(left, right)
}

// Equality as the merge reads it: for a type whose order carries no meaning
// the entries compare as a multiset, for an ordered or keyless one by position.
export const sameContent = (left: Side, right: Side): boolean =>
  sameValue(left, right)
