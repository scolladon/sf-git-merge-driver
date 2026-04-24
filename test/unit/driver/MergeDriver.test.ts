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

vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    rename: async () => undefined,
    unlink: async () => undefined,
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
    it('when merged then the no-op error listener prevents a process-level unhandled event', async () => {
      // This scenario is hard to reproduce against a real filesystem
      // (disk-full / permission-denied mid-write). Injecting the
      // error on the mock sink is the cleanest route. The invariant
      // under test is the listener itself: without the `tmpWS.on(
      // 'error', noop)` registration in MergeDriver, Node would
      // escalate the event to an uncaught exception and crash the
      // process — failing this test. Resolution value is incidental.
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeThreeWay.mockImplementation(async () => {
        sink.emit('error', new Error('tmp write boom'))
        return { hasConflict: false }
      })
      // Just proving no uncaught event: the call resolves without
      // the test runner blowing up.
      await expect(sut.mergeFiles('a', 'o', 't')).resolves.toBeTypeOf('boolean')
    })
  })

  describe('given peekEol itself rejects (ours file unreadable)', () => {
    it('when merged then returns hasConflict=true without crashing', async () => {
      mockPeekEol.mockRejectedValue(new Error('ENOENT ours'))
      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })
})
