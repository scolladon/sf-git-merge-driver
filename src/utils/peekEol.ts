import { open } from 'node:fs/promises'

const CRLF = '\r\n'
const LF = '\n'
const PEEK_BYTES = 4096
const NEWLINE = 0x0a
const CR = 0x0d

// Read up to the first 4 KB of `path` to detect the target EOL
// convention without loading the whole file. Matches the semantics of
// detectEol on that prefix: if a `\n` preceded by `\r` is seen first,
// the file is CRLF; if a bare `\n` is seen first, the file is LF.
// Falls back to LF when no newline is present in the prefix.
export const peekEol = async (path: string): Promise<'\n' | '\r\n'> => {
  const handle = await open(path, 'r')
  try {
    const buf = Buffer.alloc(PEEK_BYTES)
    const { bytesRead } = await handle.read(buf, 0, PEEK_BYTES, 0)
    const view = buf.subarray(0, bytesRead)
    const nlIdx = view.indexOf(NEWLINE)
    // `nlIdx > 0` implies both "newline found" (nlIdx !== -1) and "not
    // at position 0" in one check: when no newline is present,
    // view.indexOf returns -1 and `-1 > 0` is false, falling through to
    // LF — so an explicit `nlIdx < 0` early return would be redundant
    // (and tripped over by equivalent-mutant reports).
    //
    // Stryker disable next-line ConditionalExpression,EqualityOperator: when nlIdx === 0 the predecessor byte is out-of-range; view[-1] yields undefined, and undefined !== CR, so both the weakened (`true`, `>=`) and strengthened variants return LF identically to the original `> 0` guard — equivalent mutant.
    return nlIdx > 0 && view[nlIdx - 1] === CR ? CRLF : LF
  } finally {
    await handle.close()
  }
}
