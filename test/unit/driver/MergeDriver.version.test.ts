import { PassThrough, Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

// This test covers the `typeof __VERSION__ !== 'undefined'` branch of
// the PIPELINE_VERSION constant in MergeDriver. It forces a bundled
// context by stubbing the global, then imports the driver fresh so the
// module-level constant re-initialises with the stubbed value.

const mockCreateReadStream = vi.fn(() => Readable.from(['<a/>']))
const mockCreateWriteStream = vi.fn(() => {
  const s = new PassThrough()
  s.resume()
  return s
})
vi.mock('node:fs', () => ({
  createReadStream: (p: string) => mockCreateReadStream(p),
  createWriteStream: (p: string) => mockCreateWriteStream(p),
}))
vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return { ...actual, rename: async () => {}, unlink: async () => {} }
})
vi.mock('../../../src/utils/peekEol.js', () => ({
  peekEol: async () => '\n',
}))
vi.mock('../../../src/merger/XmlMerger.js', () => {
  const XmlMerger = vi.fn()
  XmlMerger.prototype.mergeThreeWay = async () => ({ hasConflict: false })
  return { XmlMerger }
})

const loggedLines: string[] = []
vi.mock('../../../src/utils/LoggingService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/utils/LoggingService.js')
  >('../../../src/utils/LoggingService.js')
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: (line: string) => loggedLines.push(line),
      error: () => {},
    },
  }
})

describe('MergeDriver — PIPELINE_VERSION global', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    loggedLines.length = 0
  })

  describe('given __VERSION__ is defined (bundled context)', () => {
    it('when driver runs then logs the defined version', async () => {
      vi.stubGlobal('__VERSION__', '9.9.9-test')
      const { MergeDriver } = await import('../../../src/driver/MergeDriver.js')
      const { defaultConfig } = await import('../../utils/testConfig.js')
      const sut = new MergeDriver(defaultConfig)
      await sut.mergeFiles('a', 'o', 't')
      expect(loggedLines).toContain('pipeline=streaming v=9.9.9-test')
    })
  })
})
