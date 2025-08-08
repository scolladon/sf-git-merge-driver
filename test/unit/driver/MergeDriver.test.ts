import { MergeDriver } from '../../../src/driver/MergeDriver.js'

const mockReadFile = jest.fn()
const mockWriteFile = jest.fn()
jest.mock('node:fs/promises', () => ({
  readFile: (...args) => mockReadFile(...args),
  writeFile: (...args) => mockWriteFile(...args),
}))

const mockedmergeThreeWay = jest.fn()
jest.mock('../../../src/merger/XmlMerger.js', () => ({
  XmlMerger: jest.fn(() => ({
    mergeThreeWay: mockedmergeThreeWay,
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
      mockedmergeThreeWay.mockReturnValue('<label>Test Object</label>')

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(mockReadFile).toHaveBeenCalledTimes(3)
      expect(mockedmergeThreeWay).toHaveBeenCalledTimes(1)
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
    })

    it('should throw an error when mergeThreeWay fails', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('<label>Test Object</label>')
      mockedmergeThreeWay.mockImplementation(() => {
        throw new Error('Tripart XML merge failed')
      })

      // Act and Assert
      await expect(
        sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')
      ).rejects.toThrow('Tripart XML merge failed')
    })

    it('should return true when there is a conflict', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('<label>Test Object</label>')
      mockedmergeThreeWay.mockReturnValue({
        output: '<label>Test Object</label>',
        hasConflict: true,
      })

      // Act
      const result = await sut.mergeFiles(
        'AncestorFile',
        'OurFile',
        'TheirFile'
      )

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when there is no conflict', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('<label>Test Object</label>')
      mockedmergeThreeWay.mockReturnValue({
        output: '<label>Test Object</label>',
        hasConflict: false,
      })

      // Act
      const result = await sut.mergeFiles(
        'AncestorFile',
        'OurFile',
        'TheirFile'
      )

      // Assert
      expect(result).toBe(false)
    })

    it('given our file uses CRLF when merging then it writes output with CRLF', async () => {
      // Arrange
      mockReadFile.mockReset()
      mockWriteFile.mockReset()
      mockReadFile
        .mockResolvedValueOnce('<a>1</a>') // ancestor
        .mockResolvedValueOnce('<a>\r\n  1\r\n</a>') // our with CRLF
        .mockResolvedValueOnce('<a>2</a>') // their
      mockedmergeThreeWay.mockReturnValue({
        output: '<a>\n  1\n</a>',
        hasConflict: false,
      })

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      const [, written] = mockWriteFile.mock.calls[0]
      expect(written).toBe('<a>\r\n  1\r\n</a>')
    })

    it('given our file uses LF when merging then it writes output unchanged (LF)', async () => {
      // Arrange
      mockReadFile.mockReset()
      mockWriteFile.mockReset()
      mockReadFile
        .mockResolvedValueOnce('<a>1</a>') // ancestor
        .mockResolvedValueOnce('<a>\n  1\n</a>') // our with LF
        .mockResolvedValueOnce('<a>2</a>') // their
      const merged = '<a>\n  1\n</a>'
      mockedmergeThreeWay.mockReturnValue({
        output: merged,
        hasConflict: false,
      })

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      const [, written] = mockWriteFile.mock.calls[0]
      expect(written).toBe(merged)
    })
  })
})
