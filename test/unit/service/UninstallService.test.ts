import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import {
  applyUninstallPlan,
  UninstallService,
} from '../../../src/service/UninstallService.js'
import { parse } from '../../../src/utils/gitAttributesFile.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'
import { Logger } from '../../../src/utils/LoggingService.js'

vi.mock('node:fs/promises')
vi.mock('simple-git')
vi.mock('../../../src/utils/gitUtils.js')
vi.mock('../../../src/utils/LoggingService.js', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../../src/utils/LoggingService.js')
    >()
  return {
    ...actual,
    Logger: {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

const GIT_ATTRIBUTES_PATH = '.git/info/attributes'
const ATTRIBUTES_CONTENT = `*.xml merge=salesforce-source\nsome other content`
const FILTERED_CONTENT = 'some other content'

const mockedRaw = vi.fn()
const simpleGitMock = simpleGit as unknown as Mock
simpleGitMock.mockReturnValue({
  raw: mockedRaw,
})

const getGitAttributesPathMocked = vi.mocked(getGitAttributesPath)
const readFileMocked = vi.mocked(readFile) as Mock

describe('UninstallService', () => {
  let sut: UninstallService

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new UninstallService()
    getGitAttributesPathMocked.mockResolvedValue(GIT_ATTRIBUTES_PATH)
    readFileMocked.mockResolvedValue(ATTRIBUTES_CONTENT)
  })

  describe('given valid parameters when uninstalling', () => {
    it('then removes merge config section', async () => {
      // Act
      await sut.uninstallMergeDriver()

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'config',
        '--remove-section',
        `merge.${DRIVER_NAME}`,
      ])
    })

    it('then writes filtered content back', async () => {
      // Act
      await sut.uninstallMergeDriver()

      // Assert
      expect(writeFile).toHaveBeenCalledWith(
        GIT_ATTRIBUTES_PATH,
        FILTERED_CONTENT
      )
    })

    it('then the outcome reports wroteAttributes=true and removedConfigSection=true', async () => {
      // Act
      const outcome = await sut.uninstallMergeDriver()

      // Assert — explicit boolean pins so mutants flipping true→false
      // on the flag assignments are killed.
      expect(outcome.removedConfigSection).toBe(true)
      expect(outcome.wroteAttributes).toBe(true)
      expect(outcome.dryRun).toBe(false)
      expect(outcome.gitAttributesPath).toBe(GIT_ATTRIBUTES_PATH)
    })
  })

  describe('given config cleanup fails when uninstalling', () => {
    it('then still cleans up attributes', async () => {
      // Arrange
      mockedRaw.mockRejectedValue(new Error('Failed to cleanup git config'))

      // Act
      await sut.uninstallMergeDriver()

      // Assert
      expect(writeFile).toHaveBeenCalledWith(
        GIT_ATTRIBUTES_PATH,
        FILTERED_CONTENT
      )
    })
  })

  describe('given both config and attributes cleanup fail when uninstalling', () => {
    it('then fails silently AND both errors are logged with their distinct prefixes', async () => {
      // Arrange
      const configError = new Error('Failed to cleanup git config')
      const attrsError = new Error('Failed to cleanup git attributes')
      mockedRaw.mockRejectedValue(configError)
      readFileMocked.mockRejectedValue(attrsError)

      // Act
      await expect(sut.uninstallMergeDriver()).resolves.not.toThrow()

      // Assert — exact log-message prefixes guard against mutants that
      // gut the string literals to "".
      expect(Logger.error).toHaveBeenCalledWith(
        'Merge driver uninstallation failed to cleanup git config',
        configError
      )
      expect(Logger.error).toHaveBeenCalledWith(
        'Merge driver uninstallation failed to cleanup git attributes',
        attrsError
      )
    })
  })

  describe('given writeFile fails when persisting the filtered attributes', () => {
    it('then the error propagates to the caller (not swallowed by the read-phase catch)', async () => {
      // Arrange — read-phase succeeds, write-phase fails. Regression
      // guard: an earlier implementation wrapped writeFile in the
      // same try/catch as readFile, logging and returning success;
      // that masked an inconsistent state where the git config
      // section was gone but the attributes file still referenced it.
      const writeError = new Error('EACCES: permission denied')
      vi.mocked(writeFile).mockRejectedValueOnce(writeError)

      // Act / Assert
      await expect(sut.uninstallMergeDriver()).rejects.toThrow(
        'EACCES: permission denied'
      )
    })
  })

  describe('combined line with user attributes + our merge', () => {
    it('Given a line like `*.profile-meta.xml text=auto merge=salesforce-source`, When uninstalling, Then the user attributes survive and only `merge=...` is stripped', () => {
      // Arrange — regression fix: the old regex deleted the whole line,
      // destroying the user's `text=auto`.
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml text=auto eol=lf merge=salesforce-source\n'
      )

      // Act
      return sut.uninstallMergeDriver().then(() => {
        // Assert
        expect(writeFile).toHaveBeenCalledTimes(1)
        const written = (writeFile as unknown as Mock).mock
          .calls[0][1] as string
        expect(written).toContain('*.profile-meta.xml')
        expect(written).toContain('text=auto')
        expect(written).toContain('eol=lf')
        expect(written).not.toContain('merge=salesforce-source')
      })
    })
  })

  describe('CRLF preservation on Windows-flavoured files', () => {
    it('Given a CRLF-terminated attributes file, When uninstalling, Then the output keeps CRLF endings (no mixed LF/CRLF)', () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '* text=auto\r\n*.profile-meta.xml merge=salesforce-source\r\n'
      )

      // Act
      return sut.uninstallMergeDriver().then(() => {
        // Assert
        const written = (writeFile as unknown as Mock).mock
          .calls[0][1] as string
        expect(written).toBe('* text=auto\r\n')
        // Sanity check: no stray LF-only terminators
        expect(written).not.toMatch(/[^\r]\n/)
      })
    })
  })

  describe('no-op — attributes file has no driver lines', () => {
    it('Given an attributes file that does not reference our driver, When uninstalling, Then writeFile is NOT called (no spurious rewrites)', () => {
      // Arrange
      readFileMocked.mockResolvedValue('* text=auto\n*.sh text\n')

      // Act
      return sut.uninstallMergeDriver().then(() => {
        // Assert — no plan actions means no file rewrite
        expect(writeFile).not.toHaveBeenCalled()
      })
    })
  })

  describe('defensive: restore-overwrite with empty originalRaw (planner contract breach)', () => {
    it('Given a hand-crafted plan whose restore-overwrite carries an empty originalRaw, When applying, Then the original line is preserved (not replaced with undefined)', () => {
      // The real planner rejects empty annotation bodies, but if a
      // future change emits restore-overwrite with no content,
      // `parse('').lines[0]` is undefined. The defensive fallback
      // preserves the incoming line so the serialise stage never
      // dereferences `undefined.raw`.
      const parsed = parse('*.profile-meta.xml merge=salesforce-source\n')
      const badPlan = {
        actions: [
          {
            kind: 'restore-overwrite' as const,
            lineIndex: 0,
            originalRaw: '',
          },
        ],
      }

      // Act
      const nextLines = applyUninstallPlan(parsed.lines, badPlan)

      // Assert — the incoming line is kept verbatim (no undefined).
      expect(nextLines).toHaveLength(1)
      expect(nextLines[0]?.kind).toBe('rule')
      expect(nextLines[0]?.raw).toBe(
        '*.profile-meta.xml merge=salesforce-source'
      )
    })
  })

  describe('defensive: restore-overwrite with multi-line originalRaw (planner contract breach)', () => {
    it('Given a hand-crafted plan whose restore-overwrite carries an embedded newline, When applying, Then the original line is preserved (not silently restored with only the first split segment)', () => {
      // The planner captures `originalRaw` from a single parsed rule
      // line, which cannot contain a newline. A hand-crafted plan
      // with an embedded `\n` would otherwise cause `parse(...).lines[0]`
      // to restore only the first segment, silently discarding the
      // rest — a partial restore masquerading as a successful one.
      // The `length === 1` guard keeps the incoming line instead.
      const parsed = parse('*.profile-meta.xml merge=salesforce-source\n')
      const badPlan = {
        actions: [
          {
            kind: 'restore-overwrite' as const,
            lineIndex: 0,
            originalRaw: '*.a merge=tool-a\n*.b merge=tool-b',
          },
        ],
      }

      // Act
      const nextLines = applyUninstallPlan(parsed.lines, badPlan)

      // Assert — the incoming line is kept verbatim. If the guard
      // were removed, `restored` would be the parsed `*.a merge=tool-a`,
      // silently losing `*.b merge=tool-b`.
      expect(nextLines).toHaveLength(1)
      expect(nextLines[0]?.kind).toBe('rule')
      expect(nextLines[0]?.raw).toBe(
        '*.profile-meta.xml merge=salesforce-source'
      )
    })
  })

  describe('dry-run', () => {
    it('Given dryRun=true, When uninstalling, Then git config is NOT touched, writeFile is NOT called, and the plan is returned', async () => {
      // Arrange
      readFileMocked.mockResolvedValue(
        '*.profile-meta.xml merge=salesforce-source\n*.profile-meta.xml text=auto merge=salesforce-source\n'
      )

      // Act
      const outcome = await sut.uninstallMergeDriver({ dryRun: true })

      // Assert — side effects suppressed
      expect(mockedRaw).not.toHaveBeenCalled()
      expect(writeFile).not.toHaveBeenCalled()

      // Assert — plan preview available: one drop, one rewrite
      expect(outcome.dryRun).toBe(true)
      expect(outcome.wroteAttributes).toBe(false)
      expect(outcome.removedConfigSection).toBe(false)
      expect(outcome.plan.actions).toEqual([
        { kind: 'drop-line', lineIndex: 0 },
        { kind: 'remove-merge-attr', lineIndex: 1 },
      ])
    })
  })

  describe('given a CRLF-terminated .gitattributes file (Windows)', () => {
    it('When uninstalling, Then preserves CRLF line endings and filters driver lines', async () => {
      // Arrange — CRLF content with the driver line in the middle
      readFileMocked.mockResolvedValue(
        `# header\r\n*.xml merge=salesforce-source\r\ntrailing line\r\n`
      )

      // Act
      await sut.uninstallMergeDriver()

      // Assert — output re-joined with CRLF (no mixed endings), driver
      // line removed, other lines preserved.
      expect(writeFile).toHaveBeenCalledWith(
        GIT_ATTRIBUTES_PATH,
        '# header\r\ntrailing line\r\n'
      )
    })
  })
})
