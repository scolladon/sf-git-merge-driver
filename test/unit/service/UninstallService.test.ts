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
})
