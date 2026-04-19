import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../../../src/constant/metadataConstant.js'
import {
  DRIVER_COMMAND,
  DRIVER_NAME_CONFIG_VALUE,
  InstallConflictError,
  InstallService,
} from '../../../src/service/InstallService.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

vi.mock('node:fs/promises')
vi.mock('simple-git')
vi.mock('../../../src/utils/gitUtils.js')

const GIT_ATTRIBUTES_PATH = '.git/info/attributes'

const mockedAddConfig = vi.fn()
const simpleGitMock = simpleGit as unknown as Mock
simpleGitMock.mockReturnValue({
  addConfig: mockedAddConfig,
})

const getGitAttributesPathMocked = getGitAttributesPath as Mock
const readFileMocked = vi.mocked(readFile) as Mock
const writeFileMocked = vi.mocked(writeFile)

// Shape the driver line must match. The absolute path is resolved at
// InstallService module load via import.meta.url; we assert its suffix and
// the 8-placeholder layout (including %S) rather than the full string.
const DRIVER_LINE_PATTERN =
  /^sh -c 'node ".+\/bin\/merge-driver\.cjs" -O "\$1" -A "\$2" -B "\$3" -P "\$4" -L "\$5" -S "\$6" -X "\$7" -Y "\$8"' -- %O %A %B %P %L %S %X %Y$/

// ENOENT shape returned by fs.readFile when the file doesn't exist.
const ENOENT = Object.assign(new Error('ENOENT: no such file'), {
  code: 'ENOENT',
})

describe('InstallService', () => {
  let sut: InstallService

  beforeEach(() => {
    sut = new InstallService()
    mockedAddConfig.mockReset()
    readFileMocked.mockReset()
    writeFileMocked.mockReset()
    getGitAttributesPathMocked.mockResolvedValue(GIT_ATTRIBUTES_PATH)
    readFileMocked.mockRejectedValue(ENOENT)
  })

  describe('module-level DRIVER_COMMAND', () => {
    it('has the expected shape: sh -c wrapper, forward-slash POSIX binary path, all 8 placeholders', () => {
      // Kills path-escape regex mutations that would drop the
      // forward-slash normalisation or strip quote escaping. Also
      // pins the constant `DRIVER_NAME_CONFIG_VALUE` string so
      // mutations like `this.name = ""` on derived values are caught.
      expect(DRIVER_COMMAND).toMatch(
        /^sh -c 'node ".+\/bin\/merge-driver\.cjs" -O "\$1" -A "\$2" -B "\$3" -P "\$4" -L "\$5" -S "\$6" -X "\$7" -Y "\$8"' -- %O %A %B %P %L %S %X %Y$/
      )
      expect(DRIVER_COMMAND).not.toMatch(/\\/) // no backslashes — POSIX path
      expect(DRIVER_NAME_CONFIG_VALUE).toBe('Salesforce source merge driver')
    })
  })

  describe('git config', () => {
    it('Given any install invocation, When running, Then writes the two git-config entries exactly once', async () => {
      // Act
      await sut.installMergeDriver()

      // Assert — two entries, no duplication via --add
      expect(mockedAddConfig).toHaveBeenCalledTimes(2)
      expect(mockedAddConfig).toHaveBeenCalledWith(
        `merge.${DRIVER_NAME}.name`,
        'Salesforce source merge driver'
      )
      expect(mockedAddConfig).toHaveBeenCalledWith(
        `merge.${DRIVER_NAME}.driver`,
        expect.stringMatching(DRIVER_LINE_PATTERN)
      )
    })

    it('Given simpleGit is created, Then it receives { unsafe: { allowUnsafeMergeDriver: true } } so the sh -c driver is accepted', async () => {
      // Act
      await sut.installMergeDriver()

      // Assert — the option matters: without it simple-git refuses to
      // set driver commands that invoke sh. Exact-shape assertion so
      // mutation drops of any key are caught.
      expect(simpleGitMock).toHaveBeenCalledWith({
        unsafe: { allowUnsafeMergeDriver: true },
      })
    })

    it('Given the resolved binary path, When installing, Then it points at bin/merge-driver.cjs relative to the plugin root', async () => {
      // Act
      await sut.installMergeDriver()

      // Assert
      const driverCall = mockedAddConfig.mock.calls.find(
        ([key]) => key === `merge.${DRIVER_NAME}.driver`
      )
      expect(driverCall).toBeDefined()
      const driverLine = driverCall?.[1] as string
      expect(driverLine).toMatch(/ ".+\/bin\/merge-driver\.cjs"/)
    })
  })

  describe('A1/A2 — fresh install (attributes file missing or empty)', () => {
    it('Given the attributes file does not exist, When installing, Then writeFile creates it with every desired pattern', async () => {
      // Arrange — readFile already rejects with ENOENT by default
      // Act
      await sut.installMergeDriver()

      // Assert
      expect(writeFileMocked).toHaveBeenCalledTimes(1)
      const [path, content] = writeFileMocked.mock.calls[0] as [string, string]
      expect(path).toBe(GIT_ATTRIBUTES_PATH)
      // Every metadata + manifest pattern is present exactly once, with our driver.
      for (const pattern of METADATA_TYPES_PATTERNS) {
        expect(content).toContain(`*.${pattern}-meta.xml merge=${DRIVER_NAME}`)
      }
      for (const pattern of MANIFEST_PATTERNS) {
        expect(content).toContain(`${pattern} merge=${DRIVER_NAME}`)
      }
    })

    it('Given an empty attributes file, When installing, Then writeFile is called with populated content', async () => {
      // Arrange
      readFileMocked.mockResolvedValue('')

      // Act
      await sut.installMergeDriver()

      // Assert
      expect(writeFileMocked).toHaveBeenCalledTimes(1)
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      expect(content).toContain(`merge=${DRIVER_NAME}`)
    })

    it('Given a non-dry-run install, Then the outcome reports dryRun=false and wroteAttributes=true', async () => {
      // Arrange — triggers write path
      // Act
      const outcome = await sut.installMergeDriver()

      // Assert — explicit booleans; kills ReturnValue mutations that
      // flip `dryRun: false` → `dryRun: true`.
      expect(outcome.dryRun).toBe(false)
      expect(outcome.wroteAttributes).toBe(true)
    })

    it('Given an idempotent re-install, Then wroteAttributes is false (no I/O)', async () => {
      // Arrange — seed the file with every pattern already present
      const seeded =
        METADATA_TYPES_PATTERNS.map(
          p => `*.${p}-meta.xml merge=${DRIVER_NAME}`
        ).join('\n') +
        '\n' +
        MANIFEST_PATTERNS.map(p => `${p} merge=${DRIVER_NAME}`).join('\n') +
        '\n'
      readFileMocked.mockResolvedValue(seeded)

      // Act
      const outcome = await sut.installMergeDriver()

      // Assert
      expect(outcome.wroteAttributes).toBe(false)
    })
  })

  describe('A3 — pre-existing unrelated rules survive', () => {
    it('Given rules on non-overlapping globs, When installing, Then user content is preserved and our rules are appended', async () => {
      // Arrange
      readFileMocked.mockResolvedValue('* text=auto\n*.sh text\n')

      // Act
      await sut.installMergeDriver()

      // Assert
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      expect(content.startsWith('* text=auto\n*.sh text\n')).toBe(true)
      expect(content).toContain(`*.profile-meta.xml merge=${DRIVER_NAME}`)
    })
  })

  describe('A4 — idempotent re-install', () => {
    it('Given the attributes file already has every pattern with our driver, When installing, Then writeFile is NOT called (no spurious rewrite)', async () => {
      // Arrange — seed the file with exactly what an install would produce
      const seeded =
        METADATA_TYPES_PATTERNS.map(
          p => `*.${p}-meta.xml merge=${DRIVER_NAME}`
        ).join('\n') +
        '\n' +
        MANIFEST_PATTERNS.map(p => `${p} merge=${DRIVER_NAME}`).join('\n') +
        '\n'
      readFileMocked.mockResolvedValue(seeded)

      // Act
      await sut.installMergeDriver()

      // Assert — git config is still updated (idempotent), but the file is untouched
      expect(writeFileMocked).not.toHaveBeenCalled()
    })
  })

  describe('dedup — legacy duplicate lines', () => {
    it('Given a pattern appears twice with our driver, When installing, Then the duplicate is silently dropped from the written output', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        `*.profile-meta.xml merge=${DRIVER_NAME}\n*.profile-meta.xml merge=${DRIVER_NAME}\n`
      )

      // Act
      await sut.installMergeDriver()

      // Assert — writeFile called, result has exactly one copy of the pattern
      expect(writeFileMocked).toHaveBeenCalledTimes(1)
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      const count = content
        .split('\n')
        .filter(
          line => line === `*.profile-meta.xml merge=${DRIVER_NAME}`
        ).length
      expect(count).toBe(1)
    })
  })

  describe('A6 — conflict with another merge driver', () => {
    it('Given another driver is already configured on one of our globs, When installing with abort policy, Then InstallConflictError is thrown and writeFile is NOT called', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act + Assert
      await expect(sut.installMergeDriver()).rejects.toBeInstanceOf(
        InstallConflictError
      )
      expect(writeFileMocked).not.toHaveBeenCalled()
    })

    it('Given the conflict error, Then it surfaces the pattern and existing driver so the command layer can show the user', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act
      const err = await sut.installMergeDriver().catch(e => e)

      // Assert
      expect(err).toBeInstanceOf(InstallConflictError)
      expect((err as InstallConflictError).conflicts).toEqual([
        {
          pattern: '*.profile-meta.xml',
          existingDriver: 'some-other-tool',
        },
      ])
    })

    it('Given a single conflict, Then the error message names the pattern, the other driver, and the total count', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act
      const err = (await sut
        .installMergeDriver()
        .catch(e => e)) as InstallConflictError

      // Assert — exact-message so mutations that gut the template
      // literal (empty string, dropped lines.join, etc.) are caught.
      expect(err.name).toBe('InstallConflictError')
      expect(err.message).toBe(
        'Installation aborted: 1 pattern(s) already configured with a different merge driver.\n  *.profile-meta.xml is already owned by merge=some-other-tool'
      )
    })

    it('Given multiple conflicts, Then each pattern appears on its own line in the error message', async () => {
      // Arrange — two patterns each owned by a different driver
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=tool-a\n*.permissionset-meta.xml merge=tool-b\n'
      )

      // Act
      const err = (await sut
        .installMergeDriver()
        .catch(e => e)) as InstallConflictError

      // Assert — newline-joined list; mutations that strip the join or
      // the per-line formatter fail here.
      expect(err.message).toContain(
        '2 pattern(s) already configured with a different merge driver.'
      )
      expect(err.message).toContain(
        '  *.profile-meta.xml is already owned by merge=tool-a'
      )
      expect(err.message).toContain(
        '  *.permissionset-meta.xml is already owned by merge=tool-b'
      )
      // The two conflict lines are separated by a newline (not
      // concatenated), which guards against `lines.join('')`.
      expect(err.message).toMatch(/tool-a\n {2}\*\.permissionset-meta\.xml/)
    })
  })

  describe('unexpected read errors', () => {
    it('Given readFile throws a non-ENOENT error, When installing, Then the error propagates (no silent fallback)', async () => {
      // Arrange
      readFileMocked.mockRejectedValue(
        Object.assign(new Error('EACCES'), { code: 'EACCES' })
      )

      // Act + Assert
      await expect(sut.installMergeDriver()).rejects.toThrow('EACCES')
    })

    it('Given readFile rejects with a bare string (not an object), When installing, Then the error propagates', async () => {
      // Defensive — the ENOENT classifier narrows on `typeof err === 'object'`
      // specifically. A string reject should bypass the fallback.
      readFileMocked.mockRejectedValue('oops')
      await expect(sut.installMergeDriver()).rejects.toBe('oops')
    })

    it('Given readFile rejects with null, When installing, Then the error propagates (null is not a readable Node error)', async () => {
      // Kills the `err && …` and `typeof === object` mutations that would
      // otherwise treat null as "missing file → fall back to empty".
      readFileMocked.mockRejectedValue(null)
      await expect(sut.installMergeDriver()).rejects.toBeNull()
    })

    it('Given readFile rejects ENOENT on a fresh repo, When installing, Then the fallback returns empty and writeFile creates the file populated with our patterns', async () => {
      // Explicit ENOENT-handling assertion — kills the "Stryker was here!"
      // string mutation on the fallback return value.
      readFileMocked.mockRejectedValue(ENOENT)
      await sut.installMergeDriver()
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      // The fallback supplies '' which parses to an empty attributes
      // file, so the resulting output must start cleanly with our
      // first pattern (no "Stryker was here!" preamble, no stray
      // prefix from a non-empty fallback).
      expect(content.startsWith('*.')).toBe(true)
    })
  })

  describe('on-conflict=skip', () => {
    it('Given another driver on our glob, When installing with onConflict=skip, Then the conflicting line is left untouched and no error is thrown', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act
      await sut.installMergeDriver({ onConflict: 'skip' })

      // Assert — file may still be written (to add the rest of our
      // patterns), but the user's line is untouched
      expect(writeFileMocked).toHaveBeenCalled()
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      expect(content).toContain('*.profile-meta.xml merge=some-other-tool')
      // And our driver was NOT added for that glob — the user's line wins
      const ourProfileLines = content
        .split('\n')
        .filter(l => l === `*.profile-meta.xml merge=${DRIVER_NAME}`)
      expect(ourProfileLines).toHaveLength(0)
    })
  })

  describe('on-conflict=overwrite', () => {
    it('Given another driver on our glob, When installing with onConflict=overwrite, Then the user line is replaced with our driver AND an annotation comment records the original raw', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act
      await sut.installMergeDriver({ onConflict: 'overwrite' })

      // Assert
      expect(writeFileMocked).toHaveBeenCalled()
      const [, content] = writeFileMocked.mock.calls[0] as [string, string]
      // Annotation above, our driver on the replaced line
      expect(content).toContain(
        '# sf-git-merge-driver overwrote: *.profile-meta.xml merge=some-other-tool'
      )
      expect(content).toContain(`*.profile-meta.xml merge=${DRIVER_NAME}`)
      // Original user line is gone (replaced)
      const originalLines = content
        .split('\n')
        .filter(l => l === '*.profile-meta.xml merge=some-other-tool')
      expect(originalLines).toHaveLength(0)
    })
  })

  describe('round-trip — overwrite install + uninstall restores user driver', () => {
    // This is the critical contract for the overwrite policy: after
    // overwrite-then-uninstall, the file looks as if we were never there.
    it("Given overwrite install then uninstall with the same attributes file, Then the user's original driver line is restored", async () => {
      // Use real fs flow in-process via the parse/planner helpers.
      // We simulate the install by running the service with a mock
      // readFile, capturing the written content, then feeding that
      // content back into the uninstall planner.
      const seed = '*.profile-meta.xml merge=some-other-tool\n'
      readFileMocked.mockResolvedValue(seed)
      await sut.installMergeDriver({ onConflict: 'overwrite' })
      const [, afterInstall] = writeFileMocked.mock.calls[0] as [string, string]
      expect(afterInstall).toContain('# sf-git-merge-driver overwrote:')

      // Simulate uninstall reading the same content we just wrote.
      const { UninstallService } = await import(
        '../../../src/service/UninstallService.js'
      )
      readFileMocked.mockReset()
      readFileMocked.mockResolvedValue(afterInstall)
      writeFileMocked.mockClear()
      await new UninstallService().uninstallMergeDriver()
      const [, afterUninstall] = writeFileMocked.mock.calls[0] as [
        string,
        string,
      ]

      // Assert — the user's original line is back, annotation + our
      // driver line are gone.
      expect(afterUninstall).toBe(seed)
    })
  })

  describe('dry-run', () => {
    it('Given dryRun=true on an empty repo, When installing, Then neither git config nor writeFile is called; the plan is returned', async () => {
      // Arrange — default ENOENT for readFile
      // Act
      const outcome = await sut.installMergeDriver({ dryRun: true })

      // Assert — nothing written, plan reflects a fresh install
      expect(writeFileMocked).not.toHaveBeenCalled()
      expect(mockedAddConfig).not.toHaveBeenCalled()
      expect(outcome.dryRun).toBe(true)
      expect(outcome.wroteAttributes).toBe(false)
      // Every desired pattern shows up as `add`
      const addPatterns = outcome.plan.actions.flatMap(a =>
        a.kind === 'add' ? [a.pattern] : []
      )
      expect(addPatterns.length).toBe(
        METADATA_TYPES_PATTERNS.length + MANIFEST_PATTERNS.length
      )
    })

    it('Given dryRun=true with a conflicting file, When installing, Then InstallConflictError is NOT thrown (conflicts show in plan)', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act — dry run returns normally; no throw
      const outcome = await sut.installMergeDriver({ dryRun: true })

      // Assert — plan carries the conflict so the command can render it
      const conflicts = outcome.plan.actions.flatMap(a =>
        a.kind === 'conflict' ? [a] : []
      )
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]?.existingDriver).toBe('some-other-tool')
      expect(writeFileMocked).not.toHaveBeenCalled()
      expect(mockedAddConfig).not.toHaveBeenCalled()
    })
  })
})
