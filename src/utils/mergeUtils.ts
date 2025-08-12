import { castArray, isNil } from 'lodash-es'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'

const CRLF = '\r\n'
const LF = '\n'

export const isObject = (
  ancestor: JsonValue | undefined | null,
  local: JsonValue | undefined | null,
  other: JsonValue | undefined | null
): boolean =>
  typeof [ancestor, other, local].find(ele => !isNil(ele)) === 'object'

export const ensureArray = (value: JsonValue): JsonArray =>
  isNil(value) ? [] : (castArray(value) as JsonArray)

export const getUniqueSortedProps = (
  ...objects: (JsonObject | JsonArray)[]
): string[] => Array.from(new Set([...objects].map(Object.keys).flat())).sort()

export const detectEol = (text: string): string =>
  text.includes(CRLF) ? CRLF : LF

export const normalizeEol = (text: string, eol: string): string => {
  if (!eol || !text) {
    return text
  }
  return normalizePlatformEol(eol)(text)
}

const normalizePlatformEol = (eol: string) => (text: string) =>
  eol === CRLF ? normalizeWindowsEol(text) : normalizeUnixEol(text)

const normalizeWindowsEol = (text: string) => {
  // Convert CRLF to LF to deal with mixed EOL
  // Then convert all the LF back to CRLF
  return normalizeUnixEol(text).split(LF).join(CRLF)
}

const normalizeUnixEol = (text: string) => {
  // Convert CRLF to LF
  return text.split(CRLF).join(LF)
}
