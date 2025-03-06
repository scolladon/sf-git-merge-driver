import { appendFile, chmod, copyFile, mkdir } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import { InstallService } from '../../../src/service/installService.js'

jest.mock('node:fs/promises')
jest.mock('simple-git')

const mockedAddConfig = jest.fn()
const simpleGitMock = simpleGit as jest.Mock
simpleGitMock.mockReturnValue({
  addConfig: mockedAddConfig,
})

const appendFileMocked = jest.mocked(appendFile)
const chmodMocked = jest.mocked(chmod)
const copyFileMocked = jest.mocked(copyFile)
const mkdirMocked = jest.mocked(mkdir)

describe('InstallService', () => {
  let sut: InstallService // System Under Test

  beforeEach(() => {
    // Arrange
    sut = new InstallService()
    mockedAddConfig.mockClear()
    appendFileMocked.mockClear()
  })

  it('should install successfully when given valid parameters', async () => {
    // Act
    await sut.installMergeDriver()

    // Assert
    expect(mockedAddConfig).toHaveBeenCalledTimes(3)
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.driver`,
      'node_modules/.bin/sf-git-merge-driver %O %A %B %P'
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.recursive`,
      'true'
    )
    expect(appendFileMocked).toHaveBeenCalledTimes(1)
    expect(appendFileMocked).toHaveBeenCalledWith(
      '.gitattributes',
      '*.xml merge=salesforce-source\n',
      { flag: 'a' }
    )
    expect(chmodMocked).toHaveBeenCalledTimes(1)
    expect(chmodMocked).toHaveBeenCalledWith(
      'node_modules/.bin/sf-git-merge-driver',
      0o755
    )
    expect(copyFileMocked).toHaveBeenCalledTimes(1)
    expect(copyFileMocked).toHaveBeenCalledWith(
      expect.stringContaining('lib/index.js'),
      expect.stringContaining('node_modules/.bin/sf-git-merge-driver')
    )
    expect(mkdirMocked).toHaveBeenCalledTimes(1)
    expect(mkdirMocked).toHaveBeenCalledWith(
      expect.stringContaining('node_modules/.bin'),
      { recursive: true }
    )
  })
})
