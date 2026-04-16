import { appendFile } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../../../src/constant/metadataConstant.js'
import { InstallService } from '../../../src/service/InstallService.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

vi.mock('node:fs/promises')
vi.mock('simple-git')
vi.mock('../../../src/utils/gitUtils.js')

const mockedAddConfig = vi.fn()
const simpleGitMock = simpleGit as Mock
simpleGitMock.mockReturnValue({
  addConfig: mockedAddConfig,
})

const getGitAttributesPathMocked = getGitAttributesPath as Mock
const appendFileMocked = vi.mocked(appendFile)

// Shape the new driver line must match. The absolute path is resolved at
// InstallService module load via import.meta.url; we assert its suffix and
// the 8-placeholder layout (including %S) rather than the full string.
const DRIVER_LINE_PATTERN =
  /^sh -c 'node ".+\/bin\/merge-driver\.cjs" -O "\$1" -A "\$2" -B "\$3" -P "\$4" -L "\$5" -S "\$6" -X "\$7" -Y "\$8"' -- %O %A %B %P %L %S %X %Y$/

describe('InstallService', () => {
  let sut: InstallService // System Under Test

  beforeEach(() => {
    sut = new InstallService()
    mockedAddConfig.mockClear()
    appendFileMocked.mockClear()
    getGitAttributesPathMocked.mockResolvedValue('.git/info/attributes')
  })

  it('Given a clean repo, When installing, Then git config and .gitattributes are written with the new binary-driver line', async () => {
    // Act
    await sut.installMergeDriver()

    // Assert — git open
    expect(getGitAttributesPathMocked).toHaveBeenCalledTimes(1)
    expect(simpleGitMock).toHaveBeenCalledWith({
      unsafe: { allowUnsafeMergeDriver: true },
    })

    // Assert — two git config entries (name + driver)
    expect(mockedAddConfig).toHaveBeenCalledTimes(2)
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    expect(mockedAddConfig).toHaveBeenCalledWith(
      `merge.${DRIVER_NAME}.driver`,
      expect.stringMatching(DRIVER_LINE_PATTERN)
    )

    // Assert — .gitattributes append
    expect(appendFileMocked).toHaveBeenCalledTimes(1)
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

  it('Given the resolved binary path, When installing, Then it points at bin/merge-driver.cjs relative to the plugin root', async () => {
    await sut.installMergeDriver()
    const driverCall = mockedAddConfig.mock.calls.find(
      ([key]) => key === `merge.${DRIVER_NAME}.driver`
    )
    expect(driverCall).toBeDefined()
    const driverLine = driverCall?.[1] as string
    // Absolute path, ends with /bin/merge-driver.cjs, wrapped in double quotes.
    expect(driverLine).toMatch(/ "\/.+\/bin\/merge-driver\.cjs"/)
  })
})
