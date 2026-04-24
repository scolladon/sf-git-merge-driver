import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

  describe('given peekEol is run with a handle-tracking open spy', () => {
    it('when complete then each handle has close() invoked exactly once (mutant-kill for the finally block)', async () => {
      // Kills the BlockStatement mutant on `finally { await
      // handle.close() }`. The `getActiveResourcesInfo` check above is
      // indirect: Node's FinalizationRegistry can close an orphaned
      // handle before the next tick, so an empty finally looks "clean"
      // in that counter. Here we wrap every handle returned by `open`
      // and assert `close` was invoked on every one of them. If the
      // finally block were emptied, close would never be called and
      // `closeCalls` would stay at 0 while the spy shows ≥ 1 open.
      const path = await write('spy-close.xml', 'ok\n')
      vi.resetModules()
      let openCalls = 0
      let closeCalls = 0
      vi.doMock('node:fs/promises', async () => {
        const actual =
          await vi.importActual<typeof import('node:fs/promises')>(
            'node:fs/promises'
          )
        return {
          ...actual,
          open: async (...args: Parameters<typeof actual.open>) => {
            openCalls++
            const handle = await actual.open(...args)
            const origClose = handle.close.bind(handle)
            handle.close = async () => {
              closeCalls++
              return origClose()
            }
            return handle
          },
        }
      })
      try {
        const { peekEol: isolated } = await import(
          '../../../src/utils/peekEol.js'
        )
        const result = await isolated(path)
        expect(result).toBe('\n')
        expect(openCalls).toBe(1)
        expect(closeCalls).toBe(1)
      } finally {
        vi.doUnmock('node:fs/promises')
        vi.resetModules()
      }
    })
  })
})
