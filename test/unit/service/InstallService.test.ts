import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../../../src/constant/metadataConstant.js'
import {
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
  })
})
