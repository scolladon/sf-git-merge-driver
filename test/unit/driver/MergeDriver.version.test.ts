import { PassThrough, Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

// These tests cover both branches of the `typeof __VERSION__ !==
// 'undefined'` ternary that initialises PIPELINE_VERSION in
// MergeDriver. Each case re-imports the driver fresh after adjusting
// the global — the module-level constant is captured at import time.
//
// Design: keep this file single-test-per-case. Every test does a
// dynamic import + vi.resetModules, which is costly; don't bulk up.

const mockCreateReadStream = vi.fn<(p: string) => Readable>(() =>
  Readable.from(['<a/>'])
)
const mockCreateWriteStream = vi.fn<(p: string) => PassThrough>(() => {
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
  return {
    ...actual,
    rename: async () => undefined,
    unlink: async () => undefined,
  }
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
      error: () => undefined,
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

  describe('given __VERSION__ is undefined (ts-node / vitest context)', () => {
    it('when driver runs then logs the literal "dev" fallback', async () => {
      // No stubGlobal — __VERSION__ is absent in the vitest default
      // context. Kills both mutants on the PIPELINE_VERSION ternary:
      //   - typeof !== 'undefined' → true  (would try to use the
      //     absent global and either throw or log 'undefined')
      //   - 'dev' → ''                    (would log empty version)
      const { MergeDriver } = await import('../../../src/driver/MergeDriver.js')
      const { defaultConfig } = await import('../../utils/testConfig.js')
      const sut = new MergeDriver(defaultConfig)
      await sut.mergeFiles('a', 'o', 't')
      expect(loggedLines).toContain('pipeline=streaming v=dev')
    })
  })
})
