import { appendFile } from 'node:fs/promises'
import { InstallService } from '../../../src/service/installService.js'

const mockedAddConfig = jest.fn()
jest.mock('simple-git', () => {
  return {
    simpleGit: () => ({
      addConfig: mockedAddConfig,
    }),
  }
})
jest.mock('node:fs/promises')

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
    expect(appendFile).toHaveBeenCalledTimes(1)
    expect(appendFile).toHaveBeenCalledWith(
      '.gitattributes',
      expect.stringContaining('*.xml merge=salesforce-source\n'),
      { flag: 'a' }
    )
  })
})
