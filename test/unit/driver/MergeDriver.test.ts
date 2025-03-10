import { MergeDriver } from '../../../src/driver/MergeDriver.js'

const mockReadFile = jest.fn()
const mockWriteFile = jest.fn()
jest.mock('node:fs/promises', () => ({
  readFile: (...args) => mockReadFile(...args),
  writeFile: (...args) => mockWriteFile(...args),
}))

const mockedTripartXmlMerge = jest.fn()
jest.mock('../../../src/merger/XmlMerger.js', () => ({
  XmlMerger: jest.fn(() => ({
    tripartXmlMerge: mockedTripartXmlMerge,
  })),
}))

describe('MergeDriver', () => {
  let sut: MergeDriver

  beforeEach(() => {
    sut = new MergeDriver()
  })

  describe('mergeFiles', () => {
    it('should merge files successfully when given valid parameters', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('<label>Test Object</label>')
      mockedTripartXmlMerge.mockReturnValue('<label>Test Object</label>')

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile', 'OutputFile')

      // Assert
      expect(mockReadFile).toHaveBeenCalledTimes(3)
      expect(mockedTripartXmlMerge).toHaveBeenCalledTimes(1)
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
    })

    it('should throw an error when tripartXmlMerge fails', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('<label>Test Object</label>')
      mockedTripartXmlMerge.mockImplementation(() => {
        throw new Error('Tripart XML merge failed')
      })

      // Act and Assert
      await expect(
        sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile', 'OutputFile')
      ).rejects.toThrowError('Tripart XML merge failed')
    })
  })
})
