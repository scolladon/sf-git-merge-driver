import { appendFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import {
  DRIVER_NAME,
  RUN_PLUGIN_COMMAND,
} from '../../../src/constant/driverConstant.js'
import { METADATA_TYPES_PATTERNS } from '../../../src/constant/metadataConstant.js'
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
      `${RUN_PLUGIN_COMMAND} --ancestor-file %O --our-file %A --theirs-file %B --output-file %P`
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.recursive`,
      'true'
    )
    expect(appendFileMocked).toHaveBeenCalledTimes(1)

    // Generate the expected content for .gitattributes
    const expectedPatterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}.xml merge=${DRIVER_NAME}`
    ).join('\n')
    const expectedContent = `${expectedPatterns}\n`

    expect(appendFileMocked).toHaveBeenCalledWith(
      '.gitattributes',
      expectedContent,
      { flag: 'a' }
    )
  })
})
