import fc from 'fast-check'
import { keyOfToken } from './readingOracle.js'

export type Tokens = readonly string[]
export type Case = readonly [ancestor: Tokens, local: Tokens, other: Tokens]

export interface Limits {
  readonly length: number
  readonly perKey: Readonly<Record<string, number>>
}

const TOKENS = ['A', 'A*', 'A+', 'B', 'X'] as const

const within = (limits: Limits) => (side: Tokens) =>
  side.length <= limits.length &&
  Object.entries(limits.perKey).every(
    ([key, most]) =>
      side.filter(token => keyOfToken(token) === key).length <= most
  )

const sideArb = (limits: Limits, tokens: Tokens): fc.Arbitrary<Tokens> =>
  fc
    .array(fc.constantFrom(...tokens), { maxLength: limits.length })
    .filter(within(limits))

export const caseArb = (
  ancestors: readonly Tokens[],
  limits: Limits,
  tokens: Tokens = TOKENS
): fc.Arbitrary<Case> =>
  fc.tuple(
    fc.constantFrom(...ancestors),
    sideArb(limits, tokens),
    sideArb(limits, tokens)
  )

export const SMALL: Limits = { length: 3, perKey: { A: 2, B: 1, X: 1 } }

export const SMALL_ANCESTORS: readonly Tokens[] = [
  ['A', 'B'],
  ['A', 'B', 'A'],
  ['A', 'A*', 'B'],
  ['A', 'B', 'A*'],
]

// Keyless tokens ('~' prefix: the content is the key, edit marks included)
// kept out of TOKENS: the zdiff3 shape suite draws from that pool.
export const IDENTITY_TOKENS: Tokens = [...TOKENS, '~a', '~a*', '~b']

// At most three copies of a key and four repeated keys on a side
export const IDENTITY: Limits = {
  length: 6,
  perKey: { A: 3, B: 2, X: 1, '~a': 3, '~a*': 2, '~b': 2 },
}

// A repeated keyless key, an edited keyless copy and keyed among keyless
export const IDENTITY_ANCESTORS: readonly Tokens[] = [
  ['A', 'B', 'A'],
  ['~a', 'B', '~a'],
  ['A', '~a', 'A', '~a'],
  ['~a', '~a', '~b', 'X'],
  ['A', 'A', 'A', 'B'],
  ['A', '~a*', 'B', '~a', 'A'],
]
