import { appendFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { InstallService } from '../../../src/service/installService.js'

jest.mock('node:fs/promises')
jest.mock('simple-git')
const mockedAddConfig = jest.fn()
const simpleGitMock = simpleGit as jest.Mock
simpleGitMock.mockReturnValue({
  addConfig: mockedAddConfig,
})

const appendFileMocked = jest.mocked(appendFile)

describe('InstallService', () => {
  let sut: InstallService // System Under Test

  beforeEach(() => {
    // Arrange
    sut = new InstallService()
  })

  it('should install successfully when given valid parameters', async () => {
    // Act
    await sut.installMergeDriver()

    // Assert
    expect(mockedAddConfig).toHaveBeenCalledTimes(3)
    expect(appendFileMocked).toHaveBeenCalledTimes(1)
    expect(appendFileMocked).toHaveBeenCalledWith(
      '.gitattributes',
      expect.stringContaining('*.xml merge=salesforce-source\n'),
      { flag: 'a' }
    )
  })
})
