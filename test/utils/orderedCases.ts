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

const sideArb = (limits: Limits): fc.Arbitrary<Tokens> =>
  fc
    .array(fc.constantFrom(...TOKENS), { maxLength: limits.length })
    .filter(within(limits))

export const caseArb = (
  ancestors: readonly Tokens[],
  limits: Limits
): fc.Arbitrary<Case> =>
  fc.tuple(fc.constantFrom(...ancestors), sideArb(limits), sideArb(limits))

export const SMALL: Limits = { length: 3, perKey: { A: 2, B: 1, X: 1 } }

export const SMALL_ANCESTORS: readonly Tokens[] = [
  ['A', 'B'],
  ['A', 'B', 'A'],
  ['A', 'A*', 'B'],
  ['A', 'B', 'A*'],
]
