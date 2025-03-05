import { readFile, writeFile } from 'node:fs/promises'
import { DRIVER_NAME } from '../../../src/constant/driverConstant.js'
import { UninstallService } from '../../../src/service/uninstallService.js'

const mockedRaw = jest.fn()
jest.mock('simple-git', () => ({
  raw: mockedRaw,
}))
jest.mock('node:fs/promises')

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
    expect(mockedRaw).toHaveBeenCalledWith(
      'config',
      '--remove-section',
      `merge.${DRIVER_NAME}`
    )
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith('.gitattributes', expect.anything())
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith('.gitattributes', expect.anything())
  })
})
