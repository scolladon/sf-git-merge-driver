import fc from 'fast-check'
import type { OrderedSides } from '../../src/merger/nodes/ordered/orderedSides.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'
import { type Case, caseArb, type Limits, type Tokens } from './orderedCases.js'
import { REORDERED_MARK } from './orderedTokens.js'

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
const SEPARATOR_LABEL = 'u'
const EDITED_SEPARATOR_LABEL = `${SEPARATOR_LABEL}${EDITED_LABEL}`

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

const opening = (gadget: string): JsonArray => [
  entry(`U${gadget}a`, SEPARATOR_LABEL),
]

const closing = (gadget: string, label: string): JsonArray => [
  entry(`U${gadget}b`, label),
]

const fenced = (tokens: Tokens, gadget: string): JsonArray => [
  ...opening(gadget),
  ...tokens.map(token => entryOf(token, gadget)),
  ...closing(gadget, SEPARATOR_LABEL),
]

// The unique keys a layout writes around one gadget
interface Joints {
  readonly opening: JsonArray
  readonly closing: JsonArray
}

type JointsOf = (side: Side, gadget: number, gadgets: number) => Joints

type Layout =
  | 'fenced'
  | 'adjacent'
  | 'editedClose'
  | 'editedBetween'
  | 'movedBetween'

// Local edits the separator; the ancestor and other keep it
const labelOn = (side: Side): string =>
  side === 'local' ? EDITED_SEPARATOR_LABEL : SEPARATOR_LABEL

// One separator after every gadget but the last
const between = (gadget: number, gadgets: number, label: string): JsonArray =>
  gadget === gadgets - 1 ? [] : closing(String(gadget), label)

// Other writes each separator after the gadget that follows it
const movedBack = (gadget: number): JsonArray =>
  gadget === 0 ? [] : closing(String(gadget - 1), SEPARATOR_LABEL)

const JOINTS: Readonly<Record<Layout, JointsOf>> = {
  fenced: (_side, gadget) => ({
    opening: opening(String(gadget)),
    closing: closing(String(gadget), SEPARATOR_LABEL),
  }),
  adjacent: () => ({ opening: [], closing: [] }),
  editedClose: (side, gadget) => ({
    opening: opening(String(gadget)),
    closing: closing(String(gadget), labelOn(side)),
  }),
  editedBetween: (side, gadget, gadgets) => ({
    opening: [],
    closing: between(gadget, gadgets, labelOn(side)),
  }),
  movedBetween: (side, gadget, gadgets) => ({
    opening: [],
    closing:
      side === 'other'
        ? movedBack(gadget)
        : between(gadget, gadgets, SEPARATOR_LABEL),
  }),
}

const gadgetBody = (
  tokens: Tokens,
  gadget: number,
  joints: Joints
): JsonArray => [
  ...joints.opening,
  ...tokens.map(token => entryOf(token, String(gadget))),
  ...joints.closing,
]

const sideOf = (
  shaped: Shaped,
  side: Side,
  gadgets: number,
  layout: Layout
): JsonArray => {
  const prefix =
    shaped.prefix === undefined
      ? []
      : fenced(shaped.prefix[side], PREFIX_GADGET)
  const body = Array.from({ length: gadgets }, (_, gadget) =>
    gadgetBody(shaped[side], gadget, JOINTS[layout](side, gadget, gadgets))
  ).flat()
  const tail = (shaped.tail?.[side] ?? []).map(token =>
    entryOf(token, TAIL_GADGET)
  )
  return [...prefix, ...body, ...tail]
}

const keysOf = (side: JsonArray): readonly string[] =>
  side.map(item => (item as JsonObject)['fullName'] as string)

const sidesOf = (
  shaped: Shaped,
  gadgets: number,
  layout: Layout
): OrderedSides => {
  const [ancestor, local, other] = SIDES.map(side =>
    sideOf(shaped, side, gadgets, layout)
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

export const shapeSides = (
  shape: Shape,
  copies: number,
  gadgets: number
): OrderedSides => sidesOf(SHAPED[shape](copies), gadgets, 'fenced')

type LayoutShape =
  | 'nocut-identical'
  | 'nocut-dropone'
  | 'nocut-dropinsert'
  | 'editedcut'
  | 'editedcut-literal'
  | 'movedcut'

// A gadget of the grid and where its unique keys stand
const LAYOUTS: Readonly<Record<LayoutShape, readonly [Shape, Layout]>> = {
  'nocut-identical': ['identical', 'adjacent'],
  'nocut-dropone': ['dropone', 'adjacent'],
  'nocut-dropinsert': ['dropinsert', 'adjacent'],
  editedcut: ['dropone', 'editedBetween'],
  'editedcut-literal': ['dropone', 'editedClose'],
  movedcut: ['dropone', 'movedBetween'],
}

export const LAYOUT_SHAPES: readonly LayoutShape[] = [
  'nocut-identical',
  'nocut-dropone',
  'nocut-dropinsert',
  'editedcut',
  'editedcut-literal',
  'movedcut',
]

export const layoutSides = (
  name: LayoutShape,
  copies: number,
  gadgets: number
): OrderedSides => {
  const [shape, layout] = LAYOUTS[name]
  return sidesOf(SHAPED[shape](copies), gadgets, layout)
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

// The key written between two parts: kept by every side, edited by one side,
// edited alike or apart by both, copied past by one side, or absent
type Join = 'kept' | 'edited' | 'alike' | 'apart' | 'copied' | 'absent'

// Two cases in seven join their parts with a key every side keeps unedited
const JOINS: readonly Join[] = [
  'kept',
  'kept',
  'edited',
  'alike',
  'apart',
  'copied',
  'absent',
]

const ANCESTOR = 0
const LOCAL = 1
const OTHER = 2

// Local and other edit the key apart: each live side its own mark
const APART_MARKS: readonly string[] = ['', '*', '+']

type JoinTokens = (
  cut: string,
  before: Tokens,
  side: number,
  editedSide: number
) => Tokens

const JOIN_TOKENS: Readonly<Record<Join, JoinTokens>> = {
  kept: cut => [cut],
  edited: (cut, _before, side, editedSide) => [
    side === editedSide ? edited(cut) : cut,
  ],
  alike: (cut, _before, side) => [side === ANCESTOR ? cut : edited(cut)],
  apart: (cut, _before, side) => [`${cut}${APART_MARKS[side]}`],
  copied: (cut, before, side, editedSide) =>
    side === editedSide ? [cut, ...before.slice(0, 1)] : [cut],
  absent: () => [],
}

const joinedSide = (
  sides: readonly Tokens[],
  join: Join,
  side: number,
  editedSide: number
): Tokens =>
  sides.flatMap((tokens, at) =>
    at === sides.length - 1
      ? tokens
      : [...tokens, ...JOIN_TOKENS[join](`C${at}`, tokens, side, editedSide)]
  )

const joinedCase = (
  parts: readonly Case[],
  join: Join,
  editedSide: number
): Case => {
  const joined = (side: number): Tokens =>
    joinedSide(
      parts.map(part => part[side]),
      join,
      side,
      editedSide
    )
  return [joined(ANCESTOR), joined(LOCAL), joined(OTHER)]
}

// Two or three parts drawn alike, each under its own names, joined by one key
const joinedPartsArb = (part: fc.Arbitrary<Case>): fc.Arbitrary<Case> =>
  fc
    .tuple(
      fc.array(part, { minLength: MIN_PARTS, maxLength: MAX_PARTS }),
      fc.constantFrom(...JOINS),
      fc.constantFrom(LOCAL, OTHER)
    )
    .map(([parts, join, side]) =>
      joinedCase(
        parts.map((drawn, at) => renamedCase(PART_NAMES[at], drawn)),
        join,
        side
      )
    )

export const cutCaseArb = (
  ancestors: readonly Tokens[],
  limits: Limits,
  tokens?: Tokens
): fc.Arbitrary<Case> => joinedPartsArb(caseArb(ancestors, limits, tokens))

const MIN_STITCHED_COPIES = 2
const MAX_STITCHED_COPIES = 3

interface DropInsert {
  readonly copies: number
  readonly dropper: number
  readonly gap: number
}

// One side drops a copy, the other writes a key in a gap between the copies:
// no copy is interchangeable, and the readings of the part merge clean to
// outputs that differ
const dropInsertPart = ({ copies, dropper, gap }: DropInsert): Case => {
  const kept = repeat('A', copies)
  const at = 1 + (gap % (copies - 1))
  const inserted = [...kept.slice(0, at), 'X', ...kept.slice(at)]
  const dropped = repeat('A', copies - 1)
  return dropper === LOCAL
    ? [kept, dropped, inserted]
    : [kept, inserted, dropped]
}

const dropInsertArb: fc.Arbitrary<Case> = fc
  .record({
    copies: fc.integer({ min: MIN_STITCHED_COPIES, max: MAX_STITCHED_COPIES }),
    dropper: fc.constantFrom(LOCAL, OTHER),
    gap: fc.nat(),
  })
  .map(dropInsertPart)

const DROP_BOTH_COPIES = 3

// Both sides drop a copy and one writes a keyless entry and a key ahead of the
// rest: the readings of the part merge clean to outputs of different lengths,
// which differ past the place where the sides themselves agree again
const dropBothPart = (inserter: number): Case => {
  const kept = repeat('A', DROP_BOTH_COPIES)
  const dropped = repeat('A', DROP_BOTH_COPIES - 1)
  const inserted = ['~a', 'X', ...dropped]
  return inserter === LOCAL
    ? [kept, inserted, dropped]
    : [kept, dropped, inserted]
}

const dropBothArb: fc.Arbitrary<Case> = fc
  .constantFrom(LOCAL, OTHER)
  .map(dropBothPart)

// Parts whose readings render apart without a conflict: joined by a cut, the
// merge part by part answers with the block it stitches, which the cases drawn
// token by token never reach
export const stitchedCaseArb: fc.Arbitrary<Case> = joinedPartsArb(
  fc.oneof(dropInsertArb, dropBothArb)
)

const SPAN_KEYS: Tokens = ['K', 'J']
const NEIGHBOUR_KEYS: Tokens = ['U', 'V', 'W']
const MIN_SPAN_COPIES = 2
const MAX_SPAN_COPIES = 3
const MIN_DROPPED = 1
const MAX_DROPPED = 2
const MAX_NEIGHBOURS = 3
const NO_SIDE = -1
// fc.option builds null once in MOVE_FREQUENCY: two cases in three move one
// unit on one side
const MOVE_FREQUENCY = 3

// Half the spans write one copy with its fields reordered, on one side
const REORDERED_SIDES: readonly number[] = [
  NO_SIDE,
  NO_SIDE,
  NO_SIDE,
  ANCESTOR,
  LOCAL,
  OTHER,
]

type Treatment =
  | 'kept'
  | 'edited'
  | 'apart'
  | 'dropped'
  | 'inserted'
  | 'reordered'

// Two neighbours in seven are kept as they are
const TREATMENTS: readonly Treatment[] = [
  'kept',
  'kept',
  'edited',
  'apart',
  'dropped',
  'inserted',
  'reordered',
]

interface CopySpan {
  readonly copies: number
  readonly dropper: number
  readonly dropped: number
  readonly reordered: number
}

interface Neighbour {
  readonly treatment: Treatment
  readonly side: number
}

interface Move {
  readonly side: number
  readonly from: number
  readonly to: number
}

// What a side writes for one key of the case
type Unit = (side: number) => Tokens

const spanArb: fc.Arbitrary<CopySpan> = fc.record({
  copies: fc.integer({ min: MIN_SPAN_COPIES, max: MAX_SPAN_COPIES }),
  dropper: fc.constantFrom(LOCAL, OTHER),
  dropped: fc.integer({ min: MIN_DROPPED, max: MAX_DROPPED }),
  reordered: fc.constantFrom(...REORDERED_SIDES),
})

const neighbourArb: fc.Arbitrary<Neighbour> = fc.record({
  treatment: fc.constantFrom(...TREATMENTS),
  side: fc.constantFrom(LOCAL, OTHER),
})

const moveArb: fc.Arbitrary<Move> = fc.record({
  side: fc.constantFrom(LOCAL, OTHER),
  from: fc.nat(),
  to: fc.nat(),
})

// The dropping side loses copies yet keeps one, so the key is always tied
const keptCopies = (span: CopySpan): number =>
  span.copies - Math.min(span.dropped, span.copies - 1)

const spanTokens =
  (key: string, span: CopySpan): Unit =>
  side => {
    const count = side === span.dropper ? keptCopies(span) : span.copies
    return Array.from({ length: count }, (_, copy) =>
      copy === 0 && side === span.reordered ? `${key}${REORDERED_MARK}` : key
    )
  }

type NeighbourTokens = (key: string, side: number, mine: boolean) => Tokens

// mine: the side is the one the neighbour is treated on; the ancestor never is
const NEIGHBOUR_TOKENS: Readonly<Record<Treatment, NeighbourTokens>> = {
  kept: key => [key],
  edited: (key, _side, mine) => [mine ? edited(key) : key],
  apart: (key, side) => [`${key}${APART_MARKS[side]}`],
  dropped: (key, _side, mine) => (mine ? [] : [key]),
  inserted: (key, _side, mine) => (mine ? [key] : []),
  reordered: (key, _side, mine) => [mine ? `${key}${REORDERED_MARK}` : key],
}

const neighbourTokens =
  (key: string, neighbour: Neighbour): Unit =>
  side =>
    NEIGHBOUR_TOKENS[neighbour.treatment](key, side, side === neighbour.side)

const unitsArb: fc.Arbitrary<readonly Unit[]> = fc
  .tuple(
    fc.array(spanArb, { minLength: 1, maxLength: SPAN_KEYS.length }),
    fc.array(neighbourArb, { maxLength: MAX_NEIGHBOURS })
  )
  .map(([spans, neighbours]) => [
    ...spans.map((span, at) => spanTokens(SPAN_KEYS[at], span)),
    ...neighbours.map((neighbour, at) =>
      neighbourTokens(NEIGHBOUR_KEYS[at], neighbour)
    ),
  ])

const movedOn = (
  units: readonly Unit[],
  move: Move | null,
  side: number
): readonly Unit[] => {
  if (move === null || move.side !== side) return units
  const from = move.from % units.length
  const to = move.to % units.length
  const rest = units.filter((_, at) => at !== from)
  return [...rest.slice(0, to), units[from], ...rest.slice(to)]
}

// Spans of identical copies one side drops some of, beside unique keys under
// every treatment that can tell the copies apart
export const groupCaseArb: fc.Arbitrary<Case> = unitsArb
  .chain(units =>
    fc.tuple(
      fc.shuffledSubarray([...units], {
        minLength: units.length,
        maxLength: units.length,
      }),
      fc.option(moveArb, { freq: MOVE_FREQUENCY })
    )
  )
  .map(([units, move]) => {
    const sideOf = (side: number): Tokens =>
      movedOn(units, move, side).flatMap(unit => unit(side))
    return [sideOf(ANCESTOR), sideOf(LOCAL), sideOf(OTHER)]
  })
