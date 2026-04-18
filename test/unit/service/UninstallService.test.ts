import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import { UninstallService } from '../../../src/service/UninstallService.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

vi.mock('node:fs/promises')
vi.mock('simple-git')
vi.mock('../../../src/utils/gitUtils.js')

const GIT_ATTRIBUTES_PATH = '.git/info/attributes'
const ATTRIBUTES_CONTENT = `*.xml merge=salesforce-source\nsome other content`
const FILTERED_CONTENT = 'some other content'

const mockedRaw = vi.fn()
const simpleGitMock = simpleGit as Mock
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

    it('then reads git attributes file', async () => {
      // Act
      await sut.uninstallMergeDriver()

      // Assert
      expect(readFile).toHaveBeenCalledWith(
        GIT_ATTRIBUTES_PATH,
        expect.anything()
      )
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
    it('then fails silently', async () => {
      // Arrange
      mockedRaw.mockRejectedValue(new Error('Failed to cleanup git config'))
      readFileMocked.mockRejectedValue(
        new Error('Failed to cleanup git attributes')
      )

      // Act & Assert
      await expect(sut.uninstallMergeDriver()).resolves.not.toThrow()
    })
  })

  describe('A8 — combined line with user attributes + our merge', () => {
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

  describe('A10 — CRLF preservation on Windows-flavoured files', () => {
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
})
