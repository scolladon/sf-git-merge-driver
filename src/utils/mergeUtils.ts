import { EOL } from 'os'

const CR = '\r'
const LF = '\n'
const CRLF = `${CR}${LF}`
const RE_CRLF = /\r\n/g
const RE_LF_OR_CRLF = /\r\n|\n/g

export const detectEol = (text: string): string => {
  if (!text) {
    return EOL
  }

  let hasCRLF = false
  let hasLF = false

  for (let i = 0; i < text.length; ++i) {
    if (text[i] === LF) {
      if (i > 0 && text[i - 1] === CR) {
        hasCRLF = true
      } else {
        hasLF = true
      }

      if (hasCRLF && hasLF) {
        return EOL
      }
    }
  }

  return hasCRLF ? CRLF : hasLF ? LF : EOL
}

export const normalizeEol = (text: string, eol: string = EOL): string => {
  if (!text) {
    return text
  }

  let regex = RE_CRLF
  if (eol === CRLF) {
    regex = RE_LF_OR_CRLF
  }

  return text.replace(regex, eol)
}
