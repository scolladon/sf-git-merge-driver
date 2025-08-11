import { castArray, isNil } from 'lodash-es'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'

const LF_OR_CRLF_REGEX = /\r?\n/g
const CRLF_ONLY_REGEX = /\r\n/g
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

  const regex = eol === CRLF ? LF_OR_CRLF_REGEX : CRLF_ONLY_REGEX
  return text.replace(regex, eol)
}
