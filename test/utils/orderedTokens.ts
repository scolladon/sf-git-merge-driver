import type { KeyedSides } from '../../src/merger/nodes/KeyedArrayIndex.js'
import { identify } from '../../src/merger/nodes/ordered/identity.js'
import type { Reading } from '../../src/merger/nodes/ordered/orderedEntry.js'
import {
  type ConflictBlock,
  isConflictBlock,
} from '../../src/types/conflictBlock.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'
import type { MergeResult } from '../../src/types/mergeResult.js'

export const ORDERED_ATTRIBUTE = 'customValue'

const KEYLESS_PREFIX = '~'
const KEY_LABEL_SEPARATOR = ':'
const LABEL_DEFAULT_SEPARATOR = '/'
const EDIT_MARKS = /[*+]+$/
const ONLY_EDIT_MARKS = /^[*+]*$/
const EMPTY_SIDE = '∅'
const CLEAN_SUFFIX = ' (clean)'

const isKeyless = (token: string): boolean => token.startsWith(KEYLESS_PREFIX)

// 'A' | 'A*' (label edited) | 'A:x' | 'A:x/y' (label and default) | '~a' (keyless)
export const toEntry = (token: string): JsonObject => {
  if (isKeyless(token)) return { label: token.slice(KEYLESS_PREFIX.length) }
  const separator = token.indexOf(KEY_LABEL_SEPARATOR)
  if (separator < 0) {
    return { fullName: token.replace(EDIT_MARKS, ''), label: token }
  }
  const [label, defaultValue] = token
    .slice(separator + 1)
    .split(LABEL_DEFAULT_SEPARATOR)
  const fullName = token.slice(0, separator)
  return defaultValue === undefined
    ? { fullName, label }
    : { fullName, label, default: defaultValue }
}

const toSide = (tokens: string): JsonArray =>
  tokens === '' ? [] : tokens.split(' ').map(toEntry)

// Content is the identity of a keyless entry: its token, whole.
const keyOf = (entry: JsonObject): string =>
  entry['fullName'] === undefined
    ? `${KEYLESS_PREFIX}${entry['label']}`
    : (entry['fullName'] as string)

const keysOf = (side: JsonArray): readonly string[] =>
  side.map(entry => keyOf(entry as JsonObject))

export const orderedSides = (
  ancestor: string,
  local: string,
  other: string
): {
  readonly ancestor: JsonArray
  readonly local: JsonArray
  readonly other: JsonArray
  readonly keys: KeyedSides
} => {
  const sides = [toSide(ancestor), toSide(local), toSide(other)] as const
  return {
    ancestor: sides[0],
    local: sides[1],
    other: sides[2],
    keys: {
      ancestor: keysOf(sides[0]),
      local: keysOf(sides[1]),
      other: keysOf(sides[2]),
    },
  }
}

export const readingsOf = (
  ancestor: string,
  local: string,
  other: string
): readonly Reading[] => {
  const sides = orderedSides(ancestor, local, other)
  return identify(sides.ancestor, sides.local, sides.other, sides.keys)
}

type BlockSide = 'local' | 'ancestor' | 'other'
const BLOCK_SIDES: readonly BlockSide[] = ['local', 'ancestor', 'other']

// Inverse of toEntry
const fromEntry = (entry: JsonObject): string => {
  const {
    fullName,
    label,
    default: defaultValue,
  } = entry as Record<string, string | undefined>
  if (fullName === undefined) return `${KEYLESS_PREFIX}${label}`
  const edits = (label as string).slice(fullName.length)
  if (
    defaultValue === undefined &&
    (label as string).startsWith(fullName) &&
    ONLY_EDIT_MARKS.test(edits)
  ) {
    return label as string
  }
  const suffix =
    defaultValue === undefined
      ? ''
      : `${LABEL_DEFAULT_SEPARATOR}${defaultValue}`
  return `${fullName}${KEY_LABEL_SEPARATOR}${label}${suffix}`
}

const sideTokens = (entries: JsonArray): string =>
  entries.length === 0
    ? EMPTY_SIDE
    : entries
        .map(entry =>
          fromEntry((entry as JsonObject)[ORDERED_ATTRIBUTE] as JsonObject)
        )
        .join(',')

const formatBlock = (block: ConflictBlock): string =>
  `<${BLOCK_SIDES.map(side => sideTokens(block[side])).join('|')}>`

const fieldsOnSide = (fields: JsonArray, side: BlockSide): JsonObject =>
  Object.assign(
    {},
    ...fields.flatMap(field => (isConflictBlock(field) ? field[side] : [field]))
  )

const absentBase = (fields: JsonArray): boolean =>
  fields.some(field => isConflictBlock(field) && field.ancestor.length === 0)

const fieldToken = (fields: JsonArray, side: BlockSide): string =>
  side === 'ancestor' && absentBase(fields)
    ? EMPTY_SIDE
    : fromEntry(fieldsOnSide(fields, side))

// An entry whose fields conflict reads as the one-member block of its tokens
const formatFieldList = (fields: JsonArray): string =>
  fields.some(isConflictBlock)
    ? `<${BLOCK_SIDES.map(side => fieldToken(fields, side)).join('|')}>`
    : fromEntry(fieldsOnSide(fields, 'local'))

const formatItem = (item: JsonObject): string => {
  if (isConflictBlock(item)) return formatBlock(item)
  const value = item[ORDERED_ATTRIBUTE]
  return Array.isArray(value)
    ? formatFieldList(value)
    : fromEntry(value as JsonObject)
}

export const formatResult = (result: MergeResult): string =>
  result.output.map(item => formatItem(item as JsonObject)).join(',') +
  (result.hasConflict ? '' : CLEAN_SUFFIX)
