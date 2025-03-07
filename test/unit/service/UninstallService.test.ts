import { readFile, writeFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import { UninstallService } from '../../../src/service/uninstallService.js'

jest.mock('node:fs/promises')
jest.mock('simple-git')
const mockedRaw = jest.fn()
const simpleGitMock = simpleGit as jest.Mock
simpleGitMock.mockReturnValue({
  raw: mockedRaw,
})

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
    expect(readFile).toHaveBeenCalledWith('.gitattributes', expect.anything())
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith('.gitattributes', expect.anything())
  })
})
