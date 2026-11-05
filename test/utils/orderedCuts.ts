import fc from 'fast-check'
import type { OrderedSides } from '../../src/merger/nodes/ordered/mergeOrdered.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'
import { type Case, caseArb, type Limits, type Tokens } from './orderedCases.js'

type Side = 'ancestor' | 'local' | 'other'
type Gadget = Readonly<Record<Side, Tokens>>
type Shaped = Gadget & {
  readonly prefix?: Gadget
  readonly tail?: Readonly<Partial<Record<Side, Tokens>>>
}
type Shape =
  | 'identical'
  | 'distinct'
  | 'dropone'
  | 'dropinsert'
  | 'swapgrow'
  | 'floorIdentical'

const SIDES: readonly Side[] = ['ancestor', 'local', 'other']

// A gadget whose every reading swaps copies, in front of the identical ones
const PREFIX_COPIES = 2
const PREFIX_GADGET = 'p'
const TAIL_GADGET = 't'
// The distinct gadget edits its first two copies on the local side
const EDITED_COPIES = 2
const EDITED_MARK = '*'
const EDITED_LABEL = ' edited'
const INDEXED_PREFIX = 'A#'

const repeat = (token: string, count: number): Tokens =>
  Array.from({ length: count }, () => token)

const indexed = (count: number): Tokens =>
  Array.from({ length: count }, (_, copy) => `${INDEXED_PREFIX}${copy}`)

const edited = (token: string): string => `${token}${EDITED_MARK}`

const identical = (copies: number): Gadget => ({
  ancestor: repeat('A', copies),
  local: [edited('A'), ...repeat('A', copies - 1)],
  other: repeat('A', copies - 1),
})

const distinct = (copies: number): Gadget => ({
  ancestor: indexed(copies),
  local: indexed(copies).map((token, copy) =>
    copy < EDITED_COPIES ? edited(token) : token
  ),
  other: [edited(`${INDEXED_PREFIX}${copies - 1}`), ...indexed(copies - 1)],
})

const dropone = (copies: number): Shaped => ({
  ancestor: repeat('A', copies),
  local: repeat('A', copies - 1),
  other: repeat('A', copies),
  tail: { other: ['Z'] },
})

const dropinsert = (copies: number): Gadget => ({
  ancestor: repeat('A', copies),
  local: repeat('A', copies - 1),
  other: ['A', 'X', ...repeat('A', copies - 1)],
})

const swapgrow = (copies: number): Gadget => ({
  ancestor: repeat('A', copies),
  local: ['A', edited('A'), ...repeat('A', copies - 1)],
  other: ['A', ...repeat(edited('A'), copies + 1)],
})

const SHAPED: Readonly<Record<Shape, (copies: number) => Shaped>> = {
  identical,
  distinct,
  dropone,
  dropinsert,
  swapgrow,
  floorIdentical: copies => ({
    ...identical(copies),
    prefix: swapgrow(PREFIX_COPIES),
  }),
}

export const SHAPES: readonly Shape[] = [
  'identical',
  'distinct',
  'dropone',
  'dropinsert',
  'swapgrow',
  'floorIdentical',
]

const entry = (key: string, label: string): JsonObject => ({
  fullName: key,
  label,
})

const entryOf = (token: string, gadget: string): JsonObject => {
  const isEdited = token.endsWith(EDITED_MARK)
  const head = isEdited ? token.slice(0, -EDITED_MARK.length) : token
  const mark = isEdited ? EDITED_LABEL : ''
  if (head === 'A') return entry(`R${gadget}`, `R${gadget}${mark}`)
  if (head === 'X') return entry(`U${gadget}x`, `u${mark}`)
  if (head === 'Z') return entry(`Z${gadget}`, 'added')
  const copy = head.slice(INDEXED_PREFIX.length)
  return entry(`R${gadget}`, `R${gadget} c${copy}${mark}`)
}

const fenced = (tokens: Tokens, gadget: string): JsonArray => [
  entry(`U${gadget}a`, 'u'),
  ...tokens.map(token => entryOf(token, gadget)),
  entry(`U${gadget}b`, 'u'),
]

const sideOf = (shaped: Shaped, side: Side, gadgets: number): JsonArray => {
  const prefix =
    shaped.prefix === undefined
      ? []
      : fenced(shaped.prefix[side], PREFIX_GADGET)
  const body = Array.from({ length: gadgets }, (_, gadget) =>
    fenced(shaped[side], String(gadget))
  ).flat()
  const tail = (shaped.tail?.[side] ?? []).map(token =>
    entryOf(token, TAIL_GADGET)
  )
  return [...prefix, ...body, ...tail]
}

const keysOf = (side: JsonArray): readonly string[] =>
  side.map(item => (item as JsonObject)['fullName'] as string)

export const shapeSides = (
  shape: Shape,
  copies: number,
  gadgets: number
): OrderedSides => {
  const shaped = SHAPED[shape](copies)
  const [ancestor, local, other] = SIDES.map(side =>
    sideOf(shaped, side, gadgets)
  )
  return {
    ancestor,
    local,
    other,
    keys: {
      ancestor: keysOf(ancestor),
      local: keysOf(local),
      other: keysOf(other),
    },
  }
}

const EDIT_SUFFIX = /[*+]+$/

type Names = Readonly<Record<string, string>>

const AS_DRAWN: Names = { A: 'A', B: 'B', X: 'X', '~a': '~a', '~b': '~b' }
const SECOND_PART: Names = { A: 'D', B: 'E', X: 'F', '~a': '~d', '~b': '~e' }
const THIRD_PART: Names = { A: 'G', B: 'H', X: 'I', '~a': '~g', '~b': '~h' }
const PART_NAMES: readonly Names[] = [AS_DRAWN, SECOND_PART, THIRD_PART]

const MIN_PARTS = 2
const MAX_PARTS = 3

// Edit marks stay on the renamed token: 'A*' becomes 'D*'
const renamed = (names: Names, token: string): string => {
  const stem = token.replace(EDIT_SUFFIX, '')
  return `${names[stem]}${token.slice(stem.length)}`
}

const renamedCase = (names: Names, [ancestor, local, other]: Case): Case => {
  const rename = (token: string): string => renamed(names, token)
  return [ancestor.map(rename), local.map(rename), other.map(rename)]
}

type NearMiss = 'none' | 'edited' | 'copied'

// Half the cases keep every cut
const NEAR_MISSES: readonly NearMiss[] = ['none', 'none', 'edited', 'copied']

const ANCESTOR = 0
const LOCAL = 1
const OTHER = 2

// An edited cut no longer holds the same value on every side; a copy of an
// earlier entry after the cut puts a key on both of its sides
const cutTokens = (cut: number, before: Tokens, miss: NearMiss): Tokens => {
  if (miss === 'edited') return [edited(`C${cut}`)]
  if (miss === 'copied') return [`C${cut}`, ...before.slice(0, 1)]
  return [`C${cut}`]
}

const joinedSide = (sides: readonly Tokens[], miss: NearMiss): Tokens =>
  sides.flatMap((tokens, at) =>
    at === sides.length - 1
      ? tokens
      : [...tokens, ...cutTokens(at, tokens, miss)]
  )

const joinedCase = (
  parts: readonly Case[],
  miss: NearMiss,
  missedSide: number
): Case => {
  const joined = (side: number): Tokens =>
    joinedSide(
      parts.map(part => part[side]),
      side === missedSide ? miss : 'none'
    )
  return [joined(ANCESTOR), joined(LOCAL), joined(OTHER)]
}

export const cutCaseArb = (
  ancestors: readonly Tokens[],
  limits: Limits,
  tokens?: Tokens
): fc.Arbitrary<Case> =>
  fc
    .tuple(
      fc.array(caseArb(ancestors, limits, tokens), {
        minLength: MIN_PARTS,
        maxLength: MAX_PARTS,
      }),
      fc.constantFrom(...NEAR_MISSES),
      fc.constantFrom(LOCAL, OTHER)
    )
    .map(([parts, miss, side]) =>
      joinedCase(
        parts.map((part, at) => renamedCase(PART_NAMES[at], part)),
        miss,
        side
      )
    )
