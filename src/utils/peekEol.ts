import { open } from 'node:fs/promises'

const CRLF = '\r\n'
const LF = '\n'
const PEEK_BYTES = 4096

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
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0x0a /* \n */) {
        return i > 0 && buf[i - 1] === 0x0d /* \r */ ? CRLF : LF
      }
    }
    return LF
  } finally {
    await handle.close()
  }
}
