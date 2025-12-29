import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import { UninstallService } from '../../../src/service/uninstallService.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

jest.mock('node:fs/promises')
jest.mock('simple-git')
jest.mock('../../../src/utils/gitUtils.js')
const mockedRaw = jest.fn()
const simpleGitMock = simpleGit as jest.Mock
simpleGitMock.mockReturnValue({
  raw: mockedRaw,
})

const getGitAttributesPathMocked = jest.mocked(getGitAttributesPath)
getGitAttributesPathMocked.mockResolvedValue('.git/info/attributes')

const readFileMocked = jest.mocked(readFile)
readFileMocked.mockResolvedValue(
  '*.xml merge=salesforce-source\nsome other content'
)

describe('UninstallService', () => {
  let sut: UninstallService // System Under Test

  beforeEach(() => {
    // Arrange
    sut = new UninstallService()
  })

  it('should uninstall successfully when given valid parameters', async () => {
    // Act
    await sut.uninstallMergeDriver()

    // Assert
    expect(mockedRaw).toHaveBeenCalledWith([
      'config',
      '--remove-section',
      `merge.${DRIVER_NAME}`,
    ])
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith(
      '.git/info/attributes',
      expect.anything()
    )
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith(
      '.git/info/attributes',
      'some other content'
    )
    expect(getGitAttributesPathMocked).toHaveBeenCalledTimes(1)
  })

  it('should cleanup attributes even when config cleanup fails', async () => {
    // Arrange
    mockedRaw.mockRejectedValue(new Error('Failed to cleanup git config'))

    // Act
    await sut.uninstallMergeDriver()

    // Assert
    expect(mockedRaw).toHaveBeenCalledWith([
      'config',
      '--remove-section',
      `merge.${DRIVER_NAME}`,
    ])
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith(
      '.git/info/attributes',
      expect.anything()
    )
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith(
      '.git/info/attributes',
      'some other content'
    )
    expect(getGitAttributesPathMocked).toHaveBeenCalledTimes(1)
  })

  it('should fail silently', async () => {
    // Arrange
    mockedRaw.mockRejectedValue(new Error('Failed to cleanup git config'))
    readFileMocked.mockRejectedValue(
      new Error('Failed to cleanup git attributes')
    )

    // Act
    await sut.uninstallMergeDriver()

    // Assert
    expect(mockedRaw).toHaveBeenCalledWith([
      'config',
      '--remove-section',
      `merge.${DRIVER_NAME}`,
    ])
    expect(readFile).toHaveBeenCalledWith(
      '.git/info/attributes',
      expect.anything()
    )
  })
})
