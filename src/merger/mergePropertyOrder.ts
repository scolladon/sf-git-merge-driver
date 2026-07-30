import {
  type JsonArray,
  type JsonObject,
  toJsonObjectOrEmpty,
} from '../types/jsonTypes.js'

const keysOf = (value: JsonObject | JsonArray | null | undefined): string[] =>
  value == null ? [] : Object.keys(toJsonObjectOrEmpty(value))

const sameSequence = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

const isSubsequence = (sub: string[], full: string[]): boolean => {
  let matched = 0
  for (const key of full) {
    if (matched < sub.length && key === sub[matched]) matched++
  }
  return matched === sub.length
}

const indexKeys = (
  lists: string[][]
): { keys: string[]; index: Map<string, number> } => {
  const unique = new Set<string>()
  for (const list of lists) for (const key of list) unique.add(key)
  const keys = [...unique].sort()
  const index = new Map<string, number>()
  for (let i = 0; i < keys.length; i++) index.set(keys[i], i)
  return { keys, index }
}

const buildEdges = (
  lists: string[][],
  index: Map<string, number>,
  size: number
): { indegree: Int32Array; successors: number[][] } => {
  const indegree = new Int32Array(size)
  const successors: number[][] = Array.from(
    { length: size },
    (): number[] => []
  )
  for (const list of lists) {
    for (let i = 1; i < list.length; i++) {
      const from = index.get(list[i - 1])!
      const to = index.get(list[i])!
      successors[from].push(to)
      indegree[to]++
    }
  }
  return { indegree, successors }
}

// When no unemitted key has indegree 0 (a cycle), the repair must not
// reach past the cycle into keys every side already agreed on: it picks
// among unemitted keys with the lowest residual indegree, tie-broken by
// rank (lowest index) via the ascending scan order.
const nextIndex = (
  size: number,
  emitted: Uint8Array,
  indegree: Int32Array
): number => {
  let best = -1
  for (let i = 0; i < size; i++) {
    if (emitted[i]) continue
    if (indegree[i] === 0) return i
    if (best === -1 || indegree[i] < indegree[best]) best = i
  }
  return best
}

const topologicalOrder = (
  keys: string[],
  indegree: Int32Array,
  successors: number[][]
): string[] => {
  const size = keys.length
  const emitted = new Uint8Array(size)
  const order: string[] = []
  for (let step = 0; step < size; step++) {
    const chosen = nextIndex(size, emitted, indegree)
    emitted[chosen] = 1
    order.push(keys[chosen])
    for (const successor of successors[chosen]) indegree[successor]--
  }
  return order
}

export const mergePropertyOrder = (
  ancestor: JsonObject | JsonArray | null | undefined,
  local: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): string[] => {
  const ancestorKeys = keysOf(ancestor)
  const localKeys = keysOf(local)
  const otherKeys = keysOf(other)

  if (
    sameSequence(localKeys, otherKeys) &&
    isSubsequence(ancestorKeys, localKeys)
  ) {
    return localKeys
  }

  const lists = [ancestorKeys, localKeys, otherKeys]
  const { keys, index } = indexKeys(lists)
  const { indegree, successors } = buildEdges(lists, index, keys.length)
  return topologicalOrder(keys, indegree, successors)
}
