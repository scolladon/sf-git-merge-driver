import type { JsonObject, JsonValue } from '../types/jsonTypes.js'

// Key order is irrelevant to equality, so objects are written with sorted keys.
const sortedKeys = (_key: string, value: unknown): unknown =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, (value as JsonObject)[key]])
      )
    : value

// Equal values share a signature: membership tests become set lookups
// instead of pairwise deep comparisons.
export const signatureOf = (value: JsonValue): string =>
  JSON.stringify(value, sortedKeys)
