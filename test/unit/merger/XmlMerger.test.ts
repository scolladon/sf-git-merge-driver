import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'

jest.mock('fast-xml-parser', () => {
  return {
    XMLParser: jest.fn().mockImplementation(() => {
      return {
        parse: xml => xml,
      }
    }),
    XMLBuilder: jest.fn().mockImplementation(() => {
      return {
        build: obj => obj,
      }
    }),
  }
})

const mockedmerge = jest.fn()
jest.mock('../../../src/merger/JsonMerger.js', () => {
  return {
    JsonMerger: jest.fn().mockImplementation(() => {
      return {
        mergeThreeWay: mockedmerge,
      }
    }),
  }
})

describe('MergeDriver', () => {
  let sut: XmlMerger

  beforeEach(() => {
    sut = new XmlMerger()
  })

  describe('mergeThreeWay', () => {
    it('should merge files successfully when given valid parameters', () => {
      // Arrange
      mockedmerge.mockReturnValue({
        output: 'MergedContent',
        hasConflict: false,
      })

      // Act
      sut.mergeThreeWay('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(XMLParser).toHaveBeenCalledTimes(1)
      expect(XMLBuilder).toHaveBeenCalledTimes(1)
      expect(JsonMerger).toHaveBeenCalledTimes(1)
    })

    it('should throw an error when mergeThreeWay fails', () => {
      // Arrange
      mockedmerge.mockImplementation(() => {
        throw new Error('Tripart XML merge failed')
      })

      // Act and Assert
      expect(() =>
        sut.mergeThreeWay('AncestorFile', 'OurFile', 'TheirFile')
      ).toThrow('Tripart XML merge failed')
    })
  })

  describe('handling special XML features', () => {
    it('should correctly handle XML special entities', () => {
      // Arrange
      const ancestorWithSpecial = '<root>&lt;special&gt;</root>'
      const ourWithSpecial = '<root>&lt;modified&gt;</root>'
      const theirWithSpecial = '<root>&lt;special&gt;</root>'
      mockedmerge.mockReturnValue({
        output: '<root>&lt;modified&gt;</root>',
        hasConflict: false,
      })

      // Act
      const result = sut.mergeThreeWay(
        ancestorWithSpecial,
        ourWithSpecial,
        theirWithSpecial
      )

      // Assert
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result.output).toContain('&lt;modified&gt;')
      expect(result.hasConflict).toBe(false)
    })

    it('should correctly handle XML comments', () => {
      // Arrange
      const ancestorWithComment = '<root><!-- original comment --></root>'
      const ourWithComment = '<root><!-- our comment --></root>'
      const theirWithComment = '<root><!-- their comment --></root>'
      mockedmerge.mockReturnValue({
        output: '<root><!-- merged comment --></root>',
        hasConflict: false,
      })

      // Act
      const result = sut.mergeThreeWay(
        ancestorWithComment,
        ourWithComment,
        theirWithComment
      )

      // Assert
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result.output).toContain('<!-- merged comment -->')
      expect(result.hasConflict).toBe(false)
    })

    it('empty files should output empty file', () => {
      // Arrange
      const ancestorWithComment = ''
      const ourWithComment = ''
      const theirWithComment = ''
      mockedmerge.mockReturnValue({ output: '', hasConflict: false })

      // Act
      const result = sut.mergeThreeWay(
        ancestorWithComment,
        ourWithComment,
        theirWithComment
      )

      // Assert
      expect(result.output).toEqual('')
      expect(result.hasConflict).toBe(false)
    })
  })
})
