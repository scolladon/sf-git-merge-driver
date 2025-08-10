import { appendFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import {
  DRIVER_NAME,
  RUN_PLUGIN_COMMAND,
} from '../../../src/constant/driverConstant.js'
import { METADATA_TYPES_PATTERNS } from '../../../src/constant/metadataConstant.js'
import { InstallService } from '../../../src/service/installService.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

jest.mock('node:fs/promises')
jest.mock('simple-git')
jest.mock('../../../src/utils/gitUtils.js')

const mockedAddConfig = jest.fn()
const simpleGitMock = simpleGit as jest.Mock
simpleGitMock.mockReturnValue({
  addConfig: mockedAddConfig,
})

const getGitAttributesPathMocked = getGitAttributesPath as jest.Mock
const appendFileMocked = jest.mocked(appendFile)

describe('InstallService', () => {
  let sut: InstallService // System Under Test

  beforeEach(() => {
    // Arrange
    sut = new InstallService()
    mockedAddConfig.mockClear()
    appendFileMocked.mockClear()
    getGitAttributesPathMocked.mockResolvedValue('.git/info/attributes')
  })

  it('should install successfully when given valid parameters', async () => {
    // Act
    await sut.installMergeDriver()

    // Assert
    expect(getGitAttributesPathMocked).toHaveBeenCalledTimes(1)
    expect(mockedAddConfig).toHaveBeenCalledTimes(3)
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.driver`,
      `${RUN_PLUGIN_COMMAND} -O %O -A %A -B %B -P %P -L %L -X %X -Y %Y`
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.recursive`,
      'true'
    )
    expect(appendFileMocked).toHaveBeenCalledTimes(1)

    // Generate the expected content for .gitattributes
    const expectedPatterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')
    const expectedContent = `${expectedPatterns}\n`

    expect(appendFileMocked).toHaveBeenCalledWith(
      '.git/info/attributes',
      expectedContent,
      { flag: 'a' }
    )
  })
})
