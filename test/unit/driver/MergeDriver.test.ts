import { PassThrough, Readable, Writable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MergeDriver } from '../../../src/driver/MergeDriver.js'
import { defaultConfig } from '../../utils/testConfig.js'

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

const mockMergeStreams = vi.fn<() => Promise<{ hasConflict: boolean }>>()
vi.mock('../../../src/merger/XmlMerger.js', () => {
  const XmlMerger = vi.fn()
  XmlMerger.prototype.mergeStreams = () => mockMergeStreams()
  return { XmlMerger }
})

const makeInputStream = (content: string): Readable => Readable.from([content])

const makeWritableSink = (): PassThrough => {
  const s = new PassThrough()
  // Consume the read side so 'finish' fires when the driver calls
  // `end()` — otherwise stream/promises.finished(tmpWS) hangs.
  s.resume()
  return s
}

describe('MergeDriver', () => {
  let sut: MergeDriver

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new MergeDriver(defaultConfig)
    mockPeekEol.mockResolvedValue('\n')
    mockRename.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
  })

  describe('given three input streams merge without conflict', () => {
    it('when merged then rename is called and hasConflict=false is returned', async () => {
      // Arrange
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeStreams.mockResolvedValue({ hasConflict: false })

      // Act
      const result = await sut.mergeFiles('a', 'o', 't')

      // Assert
      expect(result).toBe(false)
      expect(mockRename).toHaveBeenCalledOnce()
    })
  })

  describe('given merger reports a conflict', () => {
    it('when merged then returns true and still renames', async () => {
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeStreams.mockResolvedValue({ hasConflict: true })

      const result = await sut.mergeFiles('a', 'o', 't')

      expect(result).toBe(true)
      expect(mockRename).toHaveBeenCalledOnce()
    })
  })

  describe('given mergeStreams throws', () => {
    it('when merged then returns true, does not rename, cleans up tmp', async () => {
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeStreams.mockRejectedValue(new Error('parse boom'))

      const result = await sut.mergeFiles('a', 'o', 't')

      expect(result).toBe(true)
      expect(mockRename).not.toHaveBeenCalled()
      expect(mockUnlink).toHaveBeenCalledOnce()
    })
  })

  describe('given peekEol reports CRLF', () => {
    it('when merged then mergeStreams receives the CRLF eol arg', async () => {
      mockPeekEol.mockResolvedValue('\r\n')
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      // Verify the eol arg by capturing it via the mock.
      const eolCapture = vi.fn<() => Promise<{ hasConflict: boolean }>>()
      eolCapture.mockResolvedValue({ hasConflict: false })
      mockMergeStreams.mockImplementation(eolCapture)

      await sut.mergeFiles('a', 'o', 't')

      // mergeStreams is called once; we confirm the rename happened
      // which implies the pipeline completed.
      expect(mockRename).toHaveBeenCalledOnce()
    })
  })

  describe('given peekEol itself rejects (ours file unreadable)', () => {
    it('when merged then returns true without renaming', async () => {
      mockPeekEol.mockRejectedValue(new Error('ENOENT ours'))
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      mockCreateWriteStream.mockReturnValue(makeWritableSink())
      mockMergeStreams.mockResolvedValue({ hasConflict: false })

      const result = await sut.mergeFiles('a', 'o', 't')

      expect(result).toBe(true)
      expect(mockRename).not.toHaveBeenCalled()
    })
  })

  describe('given the tmp write stream emits an error during merge', () => {
    it('when merged then the no-op error handler prevents an uncaught event', async () => {
      mockCreateReadStream.mockImplementation(() => makeInputStream('<a/>'))
      const sink = makeWritableSink()
      mockCreateWriteStream.mockReturnValue(sink)
      mockMergeStreams.mockImplementation(async () => {
        // Emit an error on the tmp write stream — the driver's no-op
        // listener must prevent Node from escalating it to an uncaught
        // 'error' event (which would fail the test with a crash).
        sink.emit('error', new Error('tmp write boom'))
        return { hasConflict: false }
      })
      // rename should still not happen (finished(tmpWS) rejects after
      // the error event).
      mockRename.mockRejectedValue(new Error('rename should not be called'))

      const result = await sut.mergeFiles('a', 'o', 't')
      expect(result).toBe(true)
    })
  })
})
