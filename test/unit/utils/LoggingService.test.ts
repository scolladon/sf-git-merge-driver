'use strict'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAppendFileSync = vi.fn()
const mockMkdirSync = vi.fn()
vi.mock('node:fs', () => ({
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
}))

const mockStderrWrite = vi.fn()

describe('LoggingService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockAppendFileSync.mockReset()
    mockMkdirSync.mockReset()
    mockStderrWrite.mockReset()
    vi.spyOn(process.stderr, 'write').mockImplementation(
      mockStderrWrite as unknown as typeof process.stderr.write
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const freshLogger = async () =>
    (await import('../../../src/utils/LoggingService.js')).Logger

  const freshLazy = async () =>
    (await import('../../../src/utils/LoggingService.js')).lazy

  describe('lazy template tag', () => {
    it('Given a static expression, When evaluating, Then returns the interpolated string', async () => {
      const lazy = await freshLazy()
      const value = 'world'
      expect(lazy`hello ${value}`()).toBe('hello world')
    })

    it('Given a deferred function expression, When evaluating, Then calls the function at evaluation time', async () => {
      const lazy = await freshLazy()
      let counter = 0
      const getter = () => ++counter
      const template = lazy`count=${getter}`
      expect(template()).toBe('count=1')
      expect(template()).toBe('count=2')
    })

    it('Given an empty template, When evaluating, Then returns empty string', async () => {
      const lazy = await freshLazy()
      expect(lazy``()).toBe('')
    })
  })

  describe('level gating (default = warn)', () => {
    it('Given no env var, When calling trace/debug/info, Then nothing is written', async () => {
      const Logger = await freshLogger()
      Logger.trace('t')
      Logger.debug('d')
      Logger.info('i')
      expect(mockAppendFileSync).not.toHaveBeenCalled()
    })

    it('Given no env var, When calling warn/error, Then a line is written', async () => {
      const Logger = await freshLogger()
      Logger.warn('w')
      Logger.error('e')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('SF_LOG_LEVEL env var', () => {
    it('Given SF_LOG_LEVEL=trace, When calling trace, Then a line is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'trace')
      const Logger = await freshLogger()
      Logger.trace('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=debug, When calling debug, Then a line is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'debug')
      const Logger = await freshLogger()
      Logger.debug('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=info, When calling info, Then a line is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'info')
      const Logger = await freshLogger()
      Logger.info('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=10 (integer, trace), When calling trace, Then a line is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', '10')
      const Logger = await freshLogger()
      Logger.trace('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=40 (integer), When calling info (30), Then nothing is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', '40')
      const Logger = await freshLogger()
      Logger.info('msg')
      expect(mockAppendFileSync).not.toHaveBeenCalled()
    })

    it('Given SF_LOG_LEVEL=40 (integer), When calling warn, Then a line is written', async () => {
      vi.stubEnv('SF_LOG_LEVEL', '40')
      const Logger = await freshLogger()
      Logger.warn('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=0, When calling any level, Then default (warn) applies', async () => {
      vi.stubEnv('SF_LOG_LEVEL', '0')
      const Logger = await freshLogger()
      Logger.trace('t')
      Logger.warn('w')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL=-5, When calling any level, Then default (warn) applies', async () => {
      vi.stubEnv('SF_LOG_LEVEL', '-5')
      const Logger = await freshLogger()
      Logger.trace('t')
      Logger.warn('w')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL invalid, When calling any level, Then default (warn) applies', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'not-a-level')
      const Logger = await freshLogger()
      Logger.info('i')
      Logger.warn('w')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('SFDX_LOG_LEVEL fallback', () => {
    it('Given SFDX_LOG_LEVEL=trace and SF_LOG_LEVEL unset, When calling trace, Then a line is written', async () => {
      vi.stubEnv('SFDX_LOG_LEVEL', 'trace')
      const Logger = await freshLogger()
      Logger.trace('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })

    it('Given SF_LOG_LEVEL set, When both env vars present, Then SF_LOG_LEVEL wins', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'error')
      vi.stubEnv('SFDX_LOG_LEVEL', 'trace')
      const Logger = await freshLogger()
      Logger.trace('msg')
      Logger.error('msg')
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('NDJSON format', () => {
    it('Given a warn call, When written, Then line is valid JSON with required fields', async () => {
      const Logger = await freshLogger()
      Logger.warn('hello')
      const written = mockAppendFileSync.mock.calls[0][1] as string
      expect(written.endsWith('\n')).toBe(true)
      const entry = JSON.parse(written.trim())
      expect(entry.level).toBe(40)
      expect(entry.msg).toBe('hello')
      expect(entry.name).toBe('sf-git-merge-driver')
      expect(entry.pid).toBe(process.pid)
      expect(typeof entry.time).toBe('number')
      expect(typeof entry.hostname).toBe('string')
    })

    it('Given a warn call, When written, Then file path uses todays date in .sf dir', async () => {
      const Logger = await freshLogger()
      Logger.warn('path-check')
      const filePath = mockAppendFileSync.mock.calls[0][0] as string
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      // Accept both / and \ as path separator (cross-platform)
      expect(filePath).toMatch(
        new RegExp(`\\.sf[/\\\\]sf-${yyyy}-${mm}-${dd}\\.log$`)
      )
    })

    it('Given meta data, When written, Then entry includes meta field', async () => {
      const Logger = await freshLogger()
      Logger.warn('m', { k: 'v' })
      const written = mockAppendFileSync.mock.calls[0][1] as string
      const entry = JSON.parse(written.trim())
      expect(entry.meta).toEqual({ k: 'v' })
    })

    it('Given no meta, When written, Then entry omits meta field', async () => {
      const Logger = await freshLogger()
      Logger.warn('m')
      const written = mockAppendFileSync.mock.calls[0][1] as string
      const entry = JSON.parse(written.trim())
      expect('meta' in entry).toBe(false)
    })
  })

  describe('lazy message evaluation', () => {
    it('Given a function message with trace level, When SF_LOG_LEVEL=trace, Then the function is evaluated', async () => {
      vi.stubEnv('SF_LOG_LEVEL', 'trace')
      const Logger = await freshLogger()
      let called = false
      Logger.trace(() => {
        called = true
        return 'computed'
      })
      expect(called).toBe(true)
    })

    it('Given a function message below threshold, When logging, Then the function is NOT evaluated', async () => {
      const Logger = await freshLogger()
      let called = false
      Logger.trace(() => {
        called = true
        return 'computed'
      })
      expect(called).toBe(false)
    })
  })

  describe('stderr mirror', () => {
    it('Given SF_LOG_STDERR=true and a warn call, When written, Then stderr receives the line', async () => {
      vi.stubEnv('SF_LOG_STDERR', 'true')
      const Logger = await freshLogger()
      Logger.warn('mirror me')
      expect(mockStderrWrite).toHaveBeenCalledTimes(1)
      const line = mockStderrWrite.mock.calls[0][0] as string
      expect(line).toContain('mirror me')
    })

    it('Given SF_LOG_STDERR unset, When warn is called, Then stderr is NOT written', async () => {
      const Logger = await freshLogger()
      Logger.warn('no mirror')
      expect(mockStderrWrite).not.toHaveBeenCalled()
    })
  })

  describe('best-effort write', () => {
    it('Given appendFileSync throws, When logging, Then the error is swallowed and the caller does not throw', async () => {
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })
      const Logger = await freshLogger()
      expect(() => Logger.warn('will fail')).not.toThrow()
    })

    it('Given mkdirSync throws, When first log, Then the error is swallowed', async () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('read-only FS')
      })
      const Logger = await freshLogger()
      expect(() => Logger.warn('first')).not.toThrow()
    })

    it('Given multiple calls, When logging, Then mkdirSync is called only once (lazy)', async () => {
      const Logger = await freshLogger()
      Logger.warn('1')
      Logger.warn('2')
      Logger.warn('3')
      expect(mockMkdirSync).toHaveBeenCalledTimes(1)
    })

    it('Given first call, When mkdirSync is invoked, Then it uses recursive: true', async () => {
      const Logger = await freshLogger()
      Logger.warn('check')
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      )
    })
  })
})
