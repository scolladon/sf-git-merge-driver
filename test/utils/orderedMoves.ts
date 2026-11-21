import fc from 'fast-check'

const TOKEN_SEPARATOR = ' '
const LOCAL_TAG = 'L'
const OTHER_TAG = 'O'
type Operation = 'keep' | 'edit' | 'delete' | 'replace' | 'add'

// Keeping dominates so that most keys stay shared; the rest feed every
// kind of change an entry can go through
const OPERATIONS = fc.constantFrom<Operation[]>(
  'keep',
  'keep',
  'keep',
  'keep',
  'edit',
  'delete',
  'replace',
  'add'
)
type Move = readonly [from: number, to: number]

export interface MovedCase {
  readonly ancestor: string
  readonly local: string
  readonly other: string
}

export const keyTokens = (size: number): string[] =>
  Array.from({ length: size }, (_, at) => `K${at}`)

// Moves the token at every `stride`-th index `shift` places later
export const movedEvery = (
  tokens: readonly string[],
  stride: number,
  shift: number
): string[] => {
  const moved = [...tokens]
  for (let from = 0; from + shift < moved.length; from += stride) {
    const [token] = moved.splice(from, 1)
    moved.splice(from + shift, 0, token as string)
  }
  return moved
}

const tokensOf = (
  operation: Operation,
  at: number,
  tag: string
): readonly string[] => {
  switch (operation) {
    case 'keep':
      return [`K${at}`]
    case 'edit':
      return [`K${at}*`]
    case 'delete':
      return []
    case 'replace':
      return [`${tag}r${at}`]
    case 'add':
      return [`K${at}`, `${tag}n${at}`]
  }
}

const appliedMoves = (
  tokens: readonly string[],
  moves: readonly Move[]
): string[] => {
  const moved = [...tokens]
  for (const [from, to] of moves) {
    if (moved.length === 0) break
    const [token] = moved.splice(from % moved.length, 1)
    moved.splice(to % (moved.length + 1), 0, token as string)
  }
  return moved
}

const sideOf = (
  operations: readonly Operation[],
  moves: readonly Move[],
  tag: string
): string =>
  appliedMoves(
    operations.flatMap((operation, at) => tokensOf(operation, at, tag)),
    moves
  ).join(TOKEN_SEPARATOR)

// 'max' lets the array reach its bound; the default size caps it near ten
const movesArb = (size: number): fc.Arbitrary<Move[]> =>
  fc.array(fc.tuple(fc.nat(), fc.nat()), {
    maxLength: Math.ceil(size / 2),
    size: 'max',
  })

// Every side holds a key at most once, and the keys a side adds or replaces
// carry its own tag, so the keys of the two sides never collide
export const movedCaseArb = (maxSize: number): fc.Arbitrary<MovedCase> =>
  fc.nat(maxSize).chain(size =>
    fc
      .record({
        local: fc.array(OPERATIONS, { minLength: size, maxLength: size }),
        other: fc.array(OPERATIONS, { minLength: size, maxLength: size }),
        localMoves: movesArb(size),
        otherMoves: movesArb(size),
        shared: fc.boolean(),
      })
      .map(({ local, other, localMoves, otherMoves, shared }) => {
        const movedOther = shared
          ? localMoves.map(([from, to]): Move => [from, to + 1])
          : otherMoves
        return {
          ancestor: keyTokens(size).join(TOKEN_SEPARATOR),
          local: sideOf(local, localMoves, LOCAL_TAG),
          other: sideOf(other, movedOther, OTHER_TAG),
        }
      })
  )

interface Stride {
  readonly stride: number
  readonly shift: number
}

const SHORTEST_STRIDE = 2
const LONGEST_STRIDE = 3

// A shift below the stride moves a token once: from the stride on, the next
// step would pick the same token up again
const strideArb: fc.Arbitrary<Stride> = fc
  .integer({ min: SHORTEST_STRIDE, max: LONGEST_STRIDE })
  .chain(stride =>
    fc.record({
      stride: fc.constant(stride),
      shift: fc.integer({ min: 1, max: stride - 1 }),
    })
  )

// Against other's strides of two and three, local's short strides end in one
// whole-array conflict or one clean order whatever the scores are: with one
// key in four or six moved one place, every output depends on them
const LOCAL_STRIDES: readonly Stride[] = [
  { stride: 4, shift: 1 },
  { stride: 6, shift: 1 },
]

// Each side moves one key of every stride: a third of the keys or more are
// moved by other and a sixth or more by both, where the random moves of
// movedCaseArb displace a few tens of them at most
export const stridedCaseArb = (
  minSize: number,
  maxSize: number
): fc.Arbitrary<MovedCase> =>
  fc
    .record({
      size: fc.integer({ min: minSize, max: maxSize }),
      local: fc.constantFrom(...LOCAL_STRIDES),
      other: strideArb,
    })
    .map(({ size, local, other }) => {
      const keys = keyTokens(size)
      const moved = ({ stride, shift }: Stride): string =>
        movedEvery(keys, stride, shift).join(TOKEN_SEPARATOR)
      return {
        ancestor: keys.join(TOKEN_SEPARATOR),
        local: moved(local),
        other: moved(other),
      }
    })
