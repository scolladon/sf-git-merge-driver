import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { peekEol } from '../../../src/utils/peekEol.js'

describe('peekEol', () => {
  let tmpRoot: string

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'sf-peek-eol-'))
  })

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  const write = async (name: string, contents: string): Promise<string> => {
    const path = join(tmpRoot, name)
    await writeFile(path, contents)
    return path
  }

  describe('given a file with LF line endings', () => {
    it('when peeked then returns "\\n"', async () => {
      const path = await write('lf.xml', 'abc\ndef\n')
      expect(await peekEol(path)).toBe('\n')
    })
  })

  describe('given a file with CRLF line endings', () => {
    it('when peeked then returns "\\r\\n"', async () => {
      const path = await write('crlf.xml', 'abc\r\ndef\r\n')
      expect(await peekEol(path)).toBe('\r\n')
    })
  })

  describe('given a file with no newline within the first 4 KB', () => {
    it('when peeked then defaults to "\\n"', async () => {
      const path = await write('nnl.xml', 'abcdef')
      expect(await peekEol(path)).toBe('\n')
    })
  })

  describe('given a file that starts with CRLF', () => {
    it('when peeked then reports CRLF (the first newline wins)', async () => {
      const path = await write('first-crlf.xml', '\r\nrest')
      expect(await peekEol(path)).toBe('\r\n')
    })
  })

  describe('given a file that starts with a bare LF', () => {
    it('when peeked then reports LF (the first newline wins)', async () => {
      const path = await write('first-lf.xml', '\nrest')
      expect(await peekEol(path)).toBe('\n')
    })
  })

  describe('given peekEol runs on a file', () => {
    it('when complete then the returned file handle is closed (no fd leak)', async () => {
      // Regression guard for the `finally { await handle.close() }`
      // path. `process.getActiveResourcesInfo()` ships in Node 17+;
      // this project requires Node ≥ 20 (asserted at binary entry),
      // so the API is always available.
      const path = await write('fd-leak.xml', 'abc\ndef\n')
      // Warm up once so any lazy-init resources register.
      await peekEol(path)
      const countActive = (): number =>
        process
          .getActiveResourcesInfo()
          .filter(s => s === 'FSReqCallback' || s === 'FileHandle').length
      const before = countActive()
      for (let i = 0; i < 50; i++) {
        expect(await peekEol(path)).toBe('\n')
      }
      expect(countActive()).toBeLessThanOrEqual(before)
    })
  })
})
