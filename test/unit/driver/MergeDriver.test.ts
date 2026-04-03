import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MergeDriver } from '../../../src/driver/MergeDriver.js'
import { defaultConfig } from '../../utils/testConfig.js'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

const mockedmergeThreeWay = vi.fn()
vi.mock('../../../src/merger/XmlMerger.js', () => {
  const XmlMerger = vi.fn()
  XmlMerger.prototype.mergeThreeWay = (...args: unknown[]) =>
    mockedmergeThreeWay(...args)
  return { XmlMerger }
})

const SIMPLE_XML = '<label>Test Object</label>'
const ANCESTOR_XML = '<label>Ancestor Object</label>'
const OUR_XML = '<label>Our Object</label>'
const THEIR_XML = '<label>Their Object</label>'
const CRLF_CONTENT = '<a>\r\n  1\r\n</a>'
const LF_CONTENT = '<a>\n  1\n</a>'
const ANCESTOR_CONTENT = '<a>1</a>'
const THEIR_CONTENT = '<a>2</a>'

describe('MergeDriver', () => {
  let sut: MergeDriver

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new MergeDriver(defaultConfig)
  })

  describe('mergeFiles', () => {
    it('given valid files when merging without conflict then returns false', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(SIMPLE_XML)
      mockedmergeThreeWay.mockReturnValue({
        output: SIMPLE_XML,
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
      expect(mockWriteFile).toHaveBeenCalledWith('OurFile', SIMPLE_XML)
    })

    it('given mergeThreeWay throws when merging then returns true and writes our content', async () => {
      // Arrange
      mockReadFile.mockResolvedValueOnce(ANCESTOR_XML)
      mockReadFile.mockResolvedValueOnce(OUR_XML)
      mockReadFile.mockResolvedValueOnce(THEIR_XML)
      mockedmergeThreeWay.mockImplementation(() => {
        throw new Error('Tripart XML merge failed')
      })

      // Act
      const result = await sut.mergeFiles(
        'AncestorFile',
        'OurFile',
        'TheirFile'
      )

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('OurFile', OUR_XML)
    })

    it('given conflict when merging then returns true', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(SIMPLE_XML)
      mockedmergeThreeWay.mockReturnValue({
        output: SIMPLE_XML,
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

    it('given no conflict when merging then returns false', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(SIMPLE_XML)
      mockedmergeThreeWay.mockReturnValue({
        output: SIMPLE_XML,
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

    it('given our file uses CRLF when merging then writes output with CRLF', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce(ANCESTOR_CONTENT)
        .mockResolvedValueOnce(CRLF_CONTENT)
        .mockResolvedValueOnce(THEIR_CONTENT)
      mockedmergeThreeWay.mockReturnValue({
        output: LF_CONTENT,
        hasConflict: false,
      })

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('OurFile', CRLF_CONTENT)
    })

    it('given our file uses LF when merging then writes output unchanged', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce(ANCESTOR_CONTENT)
        .mockResolvedValueOnce(LF_CONTENT)
        .mockResolvedValueOnce(THEIR_CONTENT)
      mockedmergeThreeWay.mockReturnValue({
        output: LF_CONTENT,
        hasConflict: false,
      })

      // Act
      await sut.mergeFiles('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('OurFile', LF_CONTENT)
    })
  })
})
