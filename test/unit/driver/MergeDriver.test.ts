import { PassThrough, Readable, Writable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MergeDriver } from '../../../src/driver/MergeDriver.js'
import { defaultConfig } from '../../utils/testConfig.js'

// Mocks here are narrowly scoped: only the behaviours that are
// impossible to trigger against the real filesystem reliably —
// injecting an error on the tmp write stream mid-write, asserting the
// exact `eol` arg propagates to mergeThreeWay. Everything else lives
// in test/integration/MergeDriver.test.ts against real tmp files.

const mockCreateReadStream = vi.fn<(path: string) => Readable>()
const mockCreateWriteStream = vi.fn<(path: string) => Writable>()
vi.mock('node:fs', () => ({
  createReadStream: (p: string) => mockCreateReadStream(p),
  createWriteStream: (p: string) => mockCreateWriteStream(p),
}))

const mockRename = vi.fn<() => Promise<void>>()
const mockUnlink = vi.fn<() => Promise<void>>()
vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    rename: () => mockRename(),
    unlink: () => mockUnlink(),
  }
})

const mockPeekEol = vi.fn<() => Promise<'\n' | '\r\n'>>()
vi.mock('../../../src/utils/peekEol.js', () => ({
  peekEol: () => mockPeekEol(),
}))

const mockMergeThreeWay =
  vi.fn<
    (
      a: Readable,
      o: Readable,
      t: Readable,
      out: Writable,
      eol?: '\n' | '\r\n'
    ) => Promise<{ hasConflict: boolean }>
  >()
vi.mock('../../../src/merger/XmlMerger.js', () => {
  const XmlMerger = vi.fn()
  XmlMerger.prototype.mergeThreeWay = (
    a: Readable,
    o: Readable,
    t: Readable,
    out: Writable,
    eol?: '\n' | '\r\n'
  ) => mockMergeThreeWay(a, o, t, out, eol)
  return { XmlMerger }
})

const makeInputStream = (content: string): Readable => Readable.from([content])

const makeWritableSink = (): PassThrough => {
  const s = new PassThrough()
  // Consume read side so 'finish' fires on end() — otherwise
  // stream/promises.finished(tmpWS) hangs.
  s.resume()
  return s
}

describe('MergeDriver (unit — mock-required edge cases only)', () => {
  let sut: MergeDriver

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new MergeDriver(defaultConfig)
    mockPeekEol.mockResolvedValue('\n')
    mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
    mockCreateWriteStream.mockReturnValue(makeWritableSink())
    mockMergeThreeWay.mockResolvedValue({ hasConflict: false })
    mockRename.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
  })

  describe('given peekEol reports CRLF', () => {
    it('when merged then mergeThreeWay is called with eol=\\r\\n', async () => {
      mockPeekEol.mockResolvedValue('\r\n')
      await sut.mergeFiles('a', 'o', 't')
      expect(mockMergeThreeWay).toHaveBeenCalledOnce()
      const eolArg = mockMergeThreeWay.mock.calls[0]![4]
      expect(eolArg).toBe('\r\n')
    })
  })

  describe('given peekEol reports LF', () => {
    it('when merged then mergeThreeWay is called with eol=\\n', async () => {
      mockPeekEol.mockResolvedValue('\n')
      await sut.mergeFiles('a', 'o', 't')
      const eolArg = mockMergeThreeWay.mock.calls[0]![4]
      expect(eolArg).toBe('\n')
    })
  })

  describe('given mergeThreeWay rejects with ENOENT (bad input path)', () => {
    it('when merged then ENOENT is rethrown for the bin to classify as exit 2', async () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockMergeThreeWay.mockRejectedValue(enoent)

      await expect(sut.mergeFiles('a', 'o', 't')).rejects.toMatchObject({
        code: 'ENOENT',
      })
    })
  })

  describe('given mergeThreeWay rejects with a non-ENOENT error', () => {
    it('when merged then returns hasConflict=true (leave-ours-alone policy)', async () => {
      mockMergeThreeWay.mockRejectedValue(new Error('parse boom'))
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })

  describe('given the tmp write stream emits error mid-merge', () => {
    it('when merged then the no-op listener absorbs it and the pipeline resolves with hasConflict=false', async () => {
      // The noop listener on tmpWS absorbs the 'error' event, so
      // `finished(tmpWS)` resolves cleanly after `end()`, `rename`
      // (mocked) succeeds, and the driver returns hasConflict=false
      // — the value produced by mergeThreeWay. If the noop listener
      // were missing, Node would escalate to an uncaught exception
      // and crash the test runner before we ever reached this
      // assertion; that's the invariant under test.
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeThreeWay.mockImplementation(async () => {
        sink.emit('error', new Error('tmp write boom'))
        return { hasConflict: false }
      })
      await expect(sut.mergeFiles('a', 'o', 't')).resolves.toBe(false)
    })
  })

  describe('given peekEol itself rejects (ours file unreadable)', () => {
    it('when merged then returns hasConflict=true without crashing', async () => {
      mockPeekEol.mockRejectedValue(new Error('ENOENT ours'))
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })

  describe('given a non-Error primitive is thrown from mergeThreeWay', () => {
    it('when merged then returns true (primitive has no `.code`, cannot be ENOENT)', async () => {
      // Kills the `typeof error === 'object'` → `true` mutant: if the
      // guard were weakened, a primitive throw would be mistaken for
      // an ENOENT Error and rethrown.
      mockMergeThreeWay.mockImplementation(() => {
        throw 'ENOENT' as unknown as Error
      })
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })

  describe('given null is thrown from mergeThreeWay', () => {
    it('when merged then returns true (null cannot be an ENOENT Error)', async () => {
      // Kills the `error !== null` → `true` mutant: if the guard were
      // weakened, `null.code === 'ENOENT'` would throw TypeError
      // instead of cleanly falling through to the swallow-and-return
      // branch.
      mockMergeThreeWay.mockImplementation(() => {
        throw null as unknown as Error
      })
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })

  describe('given a function with a fake ENOENT code is thrown from mergeThreeWay', () => {
    it('when merged then returns true (typeof function !== "object"; guard must reject)', async () => {
      // Kills the `typeof error === 'object'` → `true` mutant. A
      // function value passes `!== null` and, by pathological design,
      // has a `.code === 'ENOENT'` property — but `typeof` is
      // 'function', not 'object'. If the guard's object check were
      // weakened, this value would be rethrown instead of swallowed.
      const fakeErr = (() => undefined) as unknown as Error & {
        code: string
      }
      fakeErr.code = 'ENOENT'
      mockMergeThreeWay.mockImplementation(() => {
        throw fakeErr
      })
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })

  describe('given unlink fails during the finally cleanup', () => {
    it('when merged then unlink is called, its error is swallowed, and hasConflict is returned', async () => {
      // Triple-assert kills both BlockStatement mutants on the
      // safeUnlink body (`try { await unlink } catch {}` emptied).
      // Without calling unlink the mock wouldn't register the
      // invocation; without the catch the rejection would escalate.
      mockUnlink.mockRejectedValue(new Error('EACCES'))
      mockMergeThreeWay.mockRejectedValue(new Error('parse boom'))
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
      expect(mockUnlink).toHaveBeenCalledOnce()
    })
  })

  describe('given the finally block runs after a successful merge', () => {
    it('when merged then every reader has destroy() called exactly once', async () => {
      // Kills the BlockStatement mutant on `for (const r of readers)
      // r.destroy()` — without the call, handles leak on Windows.
      const destroySpies: ReturnType<typeof vi.spyOn>[] = []
      mockCreateReadStream.mockImplementation(() => {
        const rs = makeInputStream('<a/>')
        destroySpies.push(vi.spyOn(rs, 'destroy'))
        return rs
      })
      await sut.mergeFiles('a', 'o', 't')
      expect(destroySpies).toHaveLength(3)
      for (const spy of destroySpies) {
        expect(spy).toHaveBeenCalledOnce()
      }
    })
  })

  describe('given the driver opens the tmp write stream', () => {
    it('when creating it then registers an "error" listener on it (not an empty-string event)', async () => {
      // Kills the StringLiteral mutant `tmpWS.on('error', noop)`
      // → `tmpWS.on('', noop)` by pinning the exact event name.
      const sink = makeWritableSink()
      const onSpy = vi.spyOn(sink, 'on')
      mockCreateWriteStream.mockReturnValue(sink)
      await sut.mergeFiles('a', 'o', 't')
      expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('given the driver opens the three read streams', () => {
    it('when creating them then each gets an "error" listener', async () => {
      // Kills the StringLiteral mutant on `rs.on('error', noop)`.
      const readerSpies: ReturnType<typeof vi.spyOn>[] = []
      mockCreateReadStream.mockImplementation(() => {
        const rs = makeInputStream('<a/>')
        readerSpies.push(vi.spyOn(rs, 'on'))
        return rs
      })
      await sut.mergeFiles('a', 'o', 't')
      expect(readerSpies).toHaveLength(3)
      for (const spy of readerSpies) {
        expect(spy).toHaveBeenCalledWith('error', expect.any(Function))
      }
    })
  })
})
