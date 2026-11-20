// The merge pipeline is UTF-8 end to end. A side in any other encoding
// is refused (surfaced as a merge conflict, ours untouched) because
// decoding it as UTF-8 would silently replace every non-ASCII byte and
// rewrite the declaration.
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])
const DECLARATION_WINDOW = 512
const XML_DECLARATION_START = '<?xml'
const XML_DECLARATION_END = '?>'
const ENCODING_ATTRIBUTE = /\bencoding\s*=\s*(?:"([^"]*)"|'([^']*)')/
const UTF8_COMPATIBLE_ENCODINGS: ReadonlySet<string> = new Set([
  'utf-8',
  'utf8',
  'us-ascii',
  'ascii',
])

const NUL = 0x00
const LESS_THAN = 0x3c
const BOM_HIGH = 0xfe
const BOM_LOW = 0xff

export const UTF16_UNSUPPORTED =
  'XML encoding error: UTF-16 is not supported, only UTF-8'
export const INVALID_UTF8 = 'XML encoding error: input is not valid UTF-8'
export const unsupportedEncoding = (name: string): string =>
  `XML encoding error: declared encoding "${name}" is not supported, only UTF-8`

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

const isUtf16 = (bytes: Buffer): boolean => {
  const [first, second] = bytes
  const isBom =
    (first === BOM_LOW && second === BOM_HIGH) ||
    (first === BOM_HIGH && second === BOM_LOW)
  const isBomlessAscii =
    (first === LESS_THAN && second === NUL) ||
    (first === NUL && second === LESS_THAN)
  return isBom || isBomlessAscii
}

const decodeStrictly = (bytes: Buffer): string => {
  try {
    return decoder.decode(bytes)
  } catch {
    throw new Error(INVALID_UTF8)
  }
}

// The declaration is ASCII in every ASCII-compatible encoding, so it is
// read before the strict decode: a Latin-1 file then reports the
// declared encoding instead of a generic invalid-byte failure.
const declaredEncoding = (bytes: Buffer): string | undefined => {
  const start = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
    ? UTF8_BOM.length
    : 0
  const head = bytes.toString('latin1', start, start + DECLARATION_WINDOW)
  if (!head.startsWith(XML_DECLARATION_START)) return undefined
  const end = head.indexOf(XML_DECLARATION_END)
  if (end === -1) return undefined
  const match = ENCODING_ATTRIBUTE.exec(head.slice(0, end))
  return match?.[1] ?? match?.[2]
}

const assertUtf8Declaration = (bytes: Buffer): void => {
  const encoding = declaredEncoding(bytes)
  if (encoding === undefined) return
  if (UTF8_COMPATIBLE_ENCODINGS.has(encoding.toLowerCase())) return
  throw new Error(unsupportedEncoding(encoding))
}

export const decodeXmlBytes = (bytes: Buffer): string => {
  if (isUtf16(bytes)) throw new Error(UTF16_UNSUPPORTED)
  assertUtf8Declaration(bytes)
  return decodeStrictly(bytes)
}
