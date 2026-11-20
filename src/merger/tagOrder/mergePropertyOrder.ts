import {
  type JsonArray,
  type JsonObject,
  toJsonObjectOrEmpty,
} from '../../types/jsonTypes.js'
import { ChildTagBlocks } from './childTagBlocks.js'
import { orderedComponents } from './childTagRelation.js'
import { ContestedTagOrder, inCanonicalOrder } from './contestedTagOrder.js'
import type { TagOrderCache } from './tagOrderCache.js'
import { ABSENT, positionsOf } from './tagPositions.js'
import { topologicalOrder } from './topologicalOrder.js'

// `blocks` maps a name in `order` to the tags a cycle among the sides'
// reorders contests together; any other name is a tag merged on its own.
export interface PropertyOrder {
  readonly order: readonly string[]
  readonly blocks: ReadonlyMap<string, readonly string[]>
}

const NO_BLOCKS: ReadonlyMap<string, readonly string[]> = new Map()

const keysOf = (value: JsonObject | JsonArray | null | undefined): string[] =>
  // Stryker disable next-line ConditionalExpression: toJsonObjectOrEmpty maps null and undefined to an empty object, whose keys are none
  value == null ? [] : Object.keys(toJsonObjectOrEmpty(value))

// Stryker disable BlockStatement: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
const sameSequence = (
  left: readonly unknown[],
  right: readonly unknown[]
): boolean => {
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  if (left.length !== right.length) return false
  // Stryker disable next-line EqualityOperator: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  for (let i = 0; i < left.length; i++) {
    // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
    if (left[i] !== right[i]) return false
  }
  // Stryker disable next-line BooleanLiteral: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  return true
}
// Stryker restore BlockStatement

// Stryker disable next-line BlockStatement: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
const isSubsequence = (sub: string[], full: string[]): boolean => {
  let matched = 0
  // Stryker disable next-line BlockStatement: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  for (const key of full) {
    // Stryker disable next-line ConditionalExpression,EqualityOperator,UpdateOperator: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
    if (matched < sub.length && key === sub[matched]) matched++
  }
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  return matched === sub.length
}

// What each side writes, as tag numbers (or where, by tag number). Tags are
// numbered in name order, so a number is also the rank of its tag.
interface Sides {
  readonly ancestor: number[]
  readonly local: number[]
  readonly other: number[]
}

const numbered = (
  keys: string[],
  [ancestor, local, other]: string[][]
): Sides => {
  const index = new Map(keys.map((key, at) => [key, at]))
  const numberAll = (list: string[]): number[] =>
    list.map(key => index.get(key)!)
  return {
    ancestor: numberAll(ancestor),
    local: numberAll(local),
    other: numberAll(other),
  }
}

const placesOf = (lists: Sides, tagCount: number): Sides => ({
  ancestor: positionsOf(lists.ancestor, tagCount),
  local: positionsOf(lists.local, tagCount),
  other: positionsOf(lists.other, tagCount),
})

// The order of the tags both live sides carry, and the smallest tag of the
// block each tag belongs to (itself when it is alone)
interface Settled {
  readonly sequence: number[]
  readonly groups: number[]
}

const identity = (size: number): number[] =>
  Array.from({ length: size }, (_, tag) => tag)

// A tag is shared when both live sides carry it, whether the ancestor does or
// not: a tag both sides add is contested like any other (ADR 073)
const isSharedTag = (places: Sides, tag: number): boolean =>
  places.local[tag] !== ABSENT && places.other[tag] !== ABSENT

// When the live sides agree on the shared tags, or one of them kept the
// ancestor's order of them and the other is free to move them, no pair is
// contested: the order is the one that moved. A tag both sides added has no
// ancestor order to keep. That keeps the common case linear.
const uncontestedOrder = (lists: Sides, places: Sides): number[] | null => {
  const isShared = (tag: number): boolean => isSharedTag(places, tag)
  // Stryker disable next-line MethodExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  const local = lists.local.filter(isShared)
  const other = lists.other.filter(isShared)
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  if (sameSequence(local, other)) return local
  // Stryker disable next-line MethodExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  const ancestor = lists.ancestor.filter(isShared)
  // Stryker disable next-line ConditionalExpression,EqualityOperator: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  if (ancestor.length !== local.length) return null
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  if (sameSequence(ancestor, local)) return other
  return sameSequence(ancestor, other) ? local : null
}

// Joins the tags of each component, then whatever the sides write between
// them, until the blocks hold together in every side and have a total order
const closedGroups = (
  lists: Sides,
  tagCount: number,
  shared: number[],
  components: number[][]
): number[] => {
  const blocks = new ChildTagBlocks(tagCount, [
    lists.local,
    lists.other,
    components.flat().map(at => shared[at]),
  ])
  for (const component of components) {
    for (const at of component) blocks.join(shared[component[0]], shared[at])
  }
  blocks.settle()
  return blocks.representatives()
}

// Tags the sides leave in a cycle, or that only one of them places differently
// from the other, are contested together with the tags written between them
// (ADR 073); whatever is left has a total order.
const contestedOrder = (lists: Sides, places: Sides): Settled => {
  // Stryker disable MethodExpression,ArithmeticOperator,ArrowFunction: the numbering of the shared tags only names them: orderedComponents ranks them by precedence
  const shared = lists.local
    .filter(tag => isSharedTag(places, tag))
    .sort((x, y) => x - y)
  // Stryker restore MethodExpression,ArithmeticOperator,ArrowFunction
  const components = orderedComponents({
    ancestor: shared.map(tag => places.ancestor[tag]),
    local: shared.map(tag => places.local[tag]),
    other: shared.map(tag => places.other[tag]),
  })
  const sequence = components.flat().map(at => shared[at])
  // Stryker disable next-line ArrowFunction,ConditionalExpression: with only single-tag components closedGroups joins nothing and returns the identity groups
  const alone = components.every(component => component.length === 1)
  return {
    sequence,
    groups: alone
      ? identity(places.local.length)
      : closedGroups(lists, places.local.length, shared, components),
  }
}

const settledOrder = (lists: Sides, places: Sides): Settled => {
  const sequence = uncontestedOrder(lists, places)
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  return sequence === null
    ? contestedOrder(lists, places)
    : { sequence, groups: identity(places.local.length) }
}

// A side's tags with each block seen as one unit, where its first tag stands
const unitsOf = (tags: number[], groups: number[]): number[] => {
  // Stryker disable next-line ArrayDeclaration: an unset flag reads undefined, as falsy as false
  const seen = new Array<boolean>(groups.length).fill(false)
  const units: number[] = []
  for (const tag of tags) {
    const unit = groups[tag]
    if (seen[unit]) continue
    seen[unit] = true
    units.push(unit)
  }
  return units
}

// Re-seats the units of the shared tags in a list in the given order, leaving
// the others where they stand
const reseat = (
  list: number[],
  sharedUnits: number[],
  isShared: boolean[]
): number[] => {
  // Stryker disable next-line ArrayDeclaration: an unset flag reads undefined, as falsy as false
  const present = new Array<boolean>(isShared.length).fill(false)
  for (const unit of list) present[unit] = true
  const inOrder = sharedUnits.filter(unit => present[unit])
  let next = 0
  return list.map(unit => (isShared[unit] ? inOrder[next++] : unit))
}

const placed = (lists: Sides, { sequence, groups }: Settled): number[] => {
  const sharedUnits = unitsOf(sequence, groups)
  const isShared = new Array<boolean>(groups.length).fill(false)
  for (const unit of sharedUnits) isShared[unit] = true
  const unitLists = [lists.ancestor, lists.local, lists.other].map(list =>
    reseat(unitsOf(list, groups), sharedUnits, isShared)
  )
  return topologicalOrder(unitLists, sharedUnits, isShared)
}

const blocksOf = (
  keys: string[],
  groups: number[]
): ReadonlyMap<string, readonly string[]> => {
  const byUnit = new Map<number, string[]>()
  groups.forEach((unit, tag) => {
    const members = byUnit.get(unit)
    if (members) members.push(keys[tag])
    else byUnit.set(unit, [keys[tag]])
  })
  const blocks = new Map<string, readonly string[]>()
  for (const [unit, members] of byUnit) {
    if (members.length > 1) blocks.set(keys[unit], members)
  }
  return blocks
}

// Stryker disable BlockStatement: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
const containsAll = (
  full: readonly string[],
  sub: readonly string[]
): boolean => {
  const present = new Set(full)
  // Stryker disable next-line ArrowFunction: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  return sub.every(key => present.has(key))
}
// Stryker restore BlockStatement

// The general merge of three key sequences: every pair is read against what
// the sides wrote, and the pairs they contradict are drawn into blocks.
export const generalKeyOrder = (
  ancestorKeys: string[],
  localKeys: string[],
  otherKeys: string[]
): PropertyOrder => {
  const sides = [ancestorKeys, localKeys, otherKeys]
  const keys = [...new Set(sides.flat())].sort()
  const lists = numbered(keys, sides)
  const settled = settledOrder(lists, placesOf(lists, keys.length))
  return {
    order: placed(lists, settled).map(tag => keys[tag]),
    blocks: blocksOf(keys, settled.groups),
  }
}

// A side that kept the ancestor's sequence leaves the other side's sequence
// as the order, provided the other side dropped none of the ancestor's tags:
// a dropped tag would be a tag the merge has to place against the rest.
// Stryker disable next-line ArrowFunction: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
const oneSidedOrder = (
  unchanged: string[],
  changed: string[],
  ancestorKeys: string[]
): PropertyOrder | undefined =>
  // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  sameSequence(ancestorKeys, unchanged) && containsAll(changed, ancestorKeys)
    ? { order: changed, blocks: NO_BLOCKS }
    : undefined

export const mergeKeyOrder = (
  ancestorKeys: string[],
  localKeys: string[],
  otherKeys: string[]
): PropertyOrder => {
  // Stryker disable BlockStatement: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
  if (
    // Stryker disable next-line ConditionalExpression: fast path of generalKeyOrder: the general path returns the same order and blocks for these inputs
    sameSequence(localKeys, otherKeys) &&
    isSubsequence(ancestorKeys, localKeys)
  ) {
    return { order: localKeys, blocks: NO_BLOCKS }
  }
  // Stryker restore BlockStatement
  return (
    // Stryker disable next-line LogicalOperator: a mix of && and ?? is a syntax error, and with both sides one-sided local, other and ancestor are the same sequence
    oneSidedOrder(otherKeys, localKeys, ancestorKeys) ??
    oneSidedOrder(localKeys, otherKeys, ancestorKeys) ??
    generalKeyOrder(ancestorKeys, localKeys, otherKeys)
  )
}

// Each block is written in its place as the tags it would hold, in canonical
// order; a one-sided reorder and the tags outside a block stay as written.
const withBlocksInCanonicalOrder = (merged: PropertyOrder): PropertyOrder =>
  // Stryker disable next-line ConditionalExpression: with no block the rebuild maps each tag to itself and ends with no blocks
  merged.blocks.size === 0
    ? merged
    : {
        order: merged.order.flatMap(name =>
          inCanonicalOrder(merged.blocks.get(name) ?? [name])
        ),
        blocks: NO_BLOCKS,
      }

export const mergePropertyOrder = (
  ancestor: JsonObject | JsonArray | null | undefined,
  local: JsonObject | JsonArray,
  other: JsonObject | JsonArray,
  contested: ContestedTagOrder = ContestedTagOrder.CONFLICT,
  cache?: TagOrderCache
): PropertyOrder => {
  const sequences = [keysOf(ancestor), keysOf(local), keysOf(other)] as [
    string[],
    string[],
    string[],
  ]
  const compute = (): PropertyOrder => {
    const merged = mergeKeyOrder(...sequences)
    return contested === ContestedTagOrder.CANONICAL
      ? withBlocksInCanonicalOrder(merged)
      : merged
  }
  return cache ? cache.orderOf(contested, sequences, compute) : compute()
}
