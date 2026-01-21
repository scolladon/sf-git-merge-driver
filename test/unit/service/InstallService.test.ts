import { appendFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import {
  DRIVER_NAME,
  RUN_PLUGIN_COMMAND,
} from '../../../src/constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../../../src/constant/metadataConstant.js'
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
    expect(mockedAddConfig).toHaveBeenCalledTimes(2)
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.driver`,
      `sh -c '${RUN_PLUGIN_COMMAND} -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -X "$6" -Y "$7"' -- %O %A %B %P %L %X %Y`
    )
    expect(appendFileMocked).toHaveBeenCalledTimes(1)

    // Generate the expected content for .gitattributes
    const expectedMetadataPatterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')
    const expectedManifestPatterns = MANIFEST_PATTERNS.map(
      pattern => `${pattern} merge=${DRIVER_NAME}`
    ).join('\n')
    const expectedContent = `${expectedMetadataPatterns}\n${expectedManifestPatterns}\n`

    expect(appendFileMocked).toHaveBeenCalledWith(
      '.git/info/attributes',
      expectedContent,
      { flag: 'a' }
    )
  })
})
