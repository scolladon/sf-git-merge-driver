'use strict'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockExistsSync = vi.fn()
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}))

const mockMergeFiles = vi.fn()
const mockMergeDriverCtor = vi.fn()
vi.mock('../../../src/driver/MergeDriver.js', () => ({
  MergeDriver: class {
    constructor(...args: unknown[]) {
      mockMergeDriverCtor(...args)
    }
    mergeFiles(...args: unknown[]) {
      return mockMergeFiles(...args)
    }
  },
}))

const { assertNodeVersion, parseArgs, main } = await import(
  '../../../src/bin/driver.js'
)

describe('bin/driver', () => {
  beforeEach(() => {
    mockExistsSync.mockReset().mockReturnValue(true)
    mockMergeFiles.mockReset().mockResolvedValue(false)
    mockMergeDriverCtor.mockReset()
  })

  describe('assertNodeVersion', () => {
    it('Given Node 20, When asserting, Then returns without throwing', () => {
      expect(() => assertNodeVersion('20.5.0')).not.toThrow()
    })

    it('Given Node 22, When asserting, Then returns without throwing', () => {
      expect(() => assertNodeVersion('22.0.0')).not.toThrow()
    })

    it('Given Node 19, When asserting, Then writes to stderr and calls process.exit(2)', () => {
      const stderr = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('__exit__')
      }) as never)

      expect(() => assertNodeVersion('19.0.0')).toThrow('__exit__')
      expect(exit).toHaveBeenCalledWith(2)
      expect(stderr).toHaveBeenCalled()
      const msg = stderr.mock.calls[0][0] as string
      expect(msg).toContain('Node.js >= 20')
      expect(msg).toContain('19.0.0')

      stderr.mockRestore()
      exit.mockRestore()
    })
  })

  describe('parseArgs — happy paths', () => {
    it('Given all flags with defaults, When parsing, Then returns ParsedArgs using imported conflictConstant defaults', () => {
      const parsed = parseArgs([
        '-O',
        'anc.xml',
        '-A',
        'loc.xml',
        '-B',
        'oth.xml',
        '-P',
        'out.xml',
      ])
      expect(parsed.ancestorFile).toBe('anc.xml')
      expect(parsed.localFile).toBe('loc.xml')
      expect(parsed.otherFile).toBe('oth.xml')
      expect(parsed.outputFile).toBe('out.xml')
      expect(parsed.config.conflictMarkerSize).toBe(7)
      expect(parsed.config.ancestorConflictTag).toBe('base')
      expect(parsed.config.localConflictTag).toBe('ours')
      expect(parsed.config.otherConflictTag).toBe('theirs')
    })

    it('Given all flags with custom values, When parsing, Then returns ParsedArgs with those values', () => {
      const parsed = parseArgs([
        '-O',
        'a',
        '-A',
        'b',
        '-B',
        'c',
        '-P',
        'd',
        '-L',
        '5',
        '-S',
        'MY_BASE',
        '-X',
        'MINE',
        '-Y',
        'YOURS',
      ])
      expect(parsed.config.conflictMarkerSize).toBe(5)
      expect(parsed.config.ancestorConflictTag).toBe('MY_BASE')
      expect(parsed.config.localConflictTag).toBe('MINE')
      expect(parsed.config.otherConflictTag).toBe('YOURS')
    })

    it('Given -L 1 (boundary), When parsing, Then succeeds with conflictMarkerSize 1', () => {
      const parsed = parseArgs([
        '-O',
        'a',
        '-A',
        'b',
        '-B',
        'c',
        '-P',
        'd',
        '-L',
        '1',
      ])
      expect(parsed.config.conflictMarkerSize).toBe(1)
    })

    it('Given empty-string values for tag flags, When parsing, Then falls back to defaults (treats empty as unset)', () => {
      const parsed = parseArgs([
        '-O',
        'a',
        '-A',
        'b',
        '-B',
        'c',
        '-P',
        'd',
        '-S',
        '',
        '-X',
        '',
        '-Y',
        '',
      ])
      expect(parsed.config.ancestorConflictTag).toBe('base')
      expect(parsed.config.localConflictTag).toBe('ours')
      expect(parsed.config.otherConflictTag).toBe('theirs')
    })

    it('Given empty-string for -L, When parsing, Then falls back to default marker size', () => {
      const parsed = parseArgs([
        '-O',
        'a',
        '-A',
        'b',
        '-B',
        'c',
        '-P',
        'd',
        '-L',
        '',
      ])
      expect(parsed.config.conflictMarkerSize).toBe(7)
    })
  })

  describe('parseArgs — errors', () => {
    it('Given missing -O, When parsing, Then throws "missing required flag"', () => {
      expect(() => parseArgs(['-A', 'a', '-B', 'b', '-P', 'p'])).toThrow(
        /missing required flag: -O/
      )
    })

    it('Given missing -A, When parsing, Then throws "missing required flag"', () => {
      expect(() => parseArgs(['-O', 'a', '-B', 'b', '-P', 'p'])).toThrow(
        /missing required flag: -A/
      )
    })

    it('Given unknown flag -Z, When parsing, Then throws "unknown argument"', () => {
      expect(() =>
        parseArgs(['-Z', 'foo', '-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd'])
      ).toThrow(/unknown argument: -Z/)
    })

    it('Given flag with no value, When parsing, Then throws "missing value"', () => {
      expect(() => parseArgs(['-O', 'a', '-A', 'b', '-B', 'c', '-P'])).toThrow(
        /missing value for -P/
      )
    })

    it('Given value that looks like a flag, When parsing, Then throws "missing value" for the preceding flag', () => {
      expect(() =>
        parseArgs(['-O', '-A', '-A', 'b', '-B', 'c', '-P', 'd'])
      ).toThrow(/missing value for -O/)
    })

    it('Given non-integer -L, When parsing, Then throws', () => {
      expect(() =>
        parseArgs(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd', '-L', 'abc'])
      ).toThrow(/-L must be an integer >= 1/)
    })

    it('Given -L 0, When parsing, Then throws', () => {
      expect(() =>
        parseArgs(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd', '-L', '0'])
      ).toThrow(/-L must be an integer >= 1/)
    })

    it('Given negative -L, When parsing, Then throws', () => {
      expect(() =>
        parseArgs(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd', '-L', '-3'])
      ).toThrow(/-L must be an integer >= 1/)
    })
  })

  describe('main — exit codes', () => {
    it('Given --version, When running, Then exits 0 and prints version to stdout', async () => {
      const stdout = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true)

      const code = await main(['--version'])

      expect(code).toBe(0)
      expect(stdout).toHaveBeenCalled()
      const out = stdout.mock.calls[0][0] as string
      expect(out.length).toBeGreaterThan(0)
      stdout.mockRestore()
    })

    it('Given --version with __VERSION__ defined (bundled build), When running, Then prints the injected version', async () => {
      vi.stubGlobal('__VERSION__', '9.9.9-test')
      const stdout = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true)

      const code = await main(['--version'])

      expect(code).toBe(0)
      expect(stdout.mock.calls[0][0]).toBe('9.9.9-test\n')
      stdout.mockRestore()
      vi.unstubAllGlobals()
    })

    it('Given --help, When running, Then exits 0 and prints usage containing all 8 flag names', async () => {
      const stdout = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true)

      const code = await main(['--help'])

      expect(code).toBe(0)
      const out = stdout.mock.calls[0][0] as string
      for (const flag of ['-O', '-A', '-B', '-P', '-L', '-S', '-X', '-Y']) {
        expect(out).toContain(flag)
      }
      stdout.mockRestore()
    })

    it('Given happy merge with no conflict, When running, Then exits 0', async () => {
      mockMergeFiles.mockResolvedValue(false)
      const code = await main(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd'])
      expect(code).toBe(0)
      expect(mockMergeFiles).toHaveBeenCalledWith('a', 'b', 'c')
    })

    it('Given merge with conflict, When running, Then exits 1', async () => {
      mockMergeFiles.mockResolvedValue(true)
      const code = await main(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd'])
      expect(code).toBe(1)
    })

    it('Given mergeFiles throws, When running, Then exits 1 with clean error message', async () => {
      mockMergeFiles.mockRejectedValue(new Error('read failed'))
      const stderr = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)

      const code = await main(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd'])

      expect(code).toBe(1)
      const msg = stderr.mock.calls[0][0] as string
      expect(msg).toContain('sf-git-merge-driver: read failed')
      stderr.mockRestore()
    })

    it('Given missing required flag, When running, Then exits 2 with sf-git-merge-driver prefix on stderr', async () => {
      const stderr = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)

      const code = await main(['-A', 'b'])

      expect(code).toBe(2)
      const msg = stderr.mock.calls[0][0] as string
      expect(msg.startsWith('sf-git-merge-driver:')).toBe(true)
      stderr.mockRestore()
    })

    it('Given non-existent -O file, When running, Then exits 2 with "file not found"', async () => {
      mockExistsSync.mockImplementation((p: string) => p !== 'a')
      const stderr = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)

      const code = await main(['-O', 'a', '-A', 'b', '-B', 'c', '-P', 'd'])

      expect(code).toBe(2)
      const msg = stderr.mock.calls[0][0] as string
      expect(msg).toContain('sf-git-merge-driver: file not found: a')
      stderr.mockRestore()
    })
  })

  describe('__BUNDLED__ guard (module bootstrap)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('Given __BUNDLED__=true, When module loads, Then calls process.exit (success path)', async () => {
      vi.resetModules()
      vi.stubGlobal('__BUNDLED__', true)

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        // intentionally empty — prevent real process.exit
      }) as never)
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      // process.argv will cause parseArgs to fail (vitest's argv), which is
      // fine — main() catches the error and returns 2, then exit(2) is called.
      await import('../../../src/bin/driver.js')

      // Give the async main().then() a tick to settle
      await new Promise(r => setTimeout(r, 50))

      expect(exitSpy).toHaveBeenCalled()
    })

    it('Given __BUNDLED__=true and main rejects, When module loads, Then rejection handler exits 1 with clean message', async () => {
      vi.resetModules()
      vi.stubGlobal('__BUNDLED__', true)

      // Force main to reject by making stdout.write throw during --version
      const origArgv = process.argv
      process.argv = ['node', 'driver.cjs', '--version']

      vi.spyOn(process.stdout, 'write').mockImplementation(() => {
        throw new Error('stdout broken')
      })
      const stderrSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true)
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        // intentionally empty — prevent real process.exit
      }) as never)

      await import('../../../src/bin/driver.js')
      await new Promise(r => setTimeout(r, 50))

      expect(exitSpy).toHaveBeenCalledWith(1)
      const msgs = stderrSpy.mock.calls.map(c => c[0] as string)
      expect(msgs.some(m => m.includes('stdout broken'))).toBe(true)

      process.argv = origArgv
    })
  })
})
