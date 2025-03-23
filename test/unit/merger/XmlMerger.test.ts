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
        merge: mockedmerge,
      }
    }),
  }
})

describe('MergeDriver', () => {
  let sut: XmlMerger

  beforeEach(() => {
    sut = new XmlMerger()
  })

  describe('tripartXmlMerge', () => {
    it('should merge files successfully when given valid parameters', () => {
      // Arrange
      mockedmerge.mockReturnValue('MergedContent')

      // Act
      sut.tripartXmlMerge('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(XMLParser).toHaveBeenCalledTimes(1)
      expect(XMLBuilder).toHaveBeenCalledTimes(1)
      expect(JsonMerger).toHaveBeenCalledTimes(1)
    })

    it('should throw an error when tripartXmlMerge fails', () => {
      // Arrange
      mockedmerge.mockImplementation(() => {
        throw new Error('Tripart XML merge failed')
      })

      // Act and Assert
      expect(() =>
        sut.tripartXmlMerge('AncestorFile', 'OurFile', 'TheirFile')
      ).toThrow('Tripart XML merge failed')
    })
  })

  describe('handling special XML features', () => {
    it('should correctly handle XML special entities', () => {
      // Arrange
      const ancestorWithSpecial = '<root>&lt;special&gt;</root>'
      const ourWithSpecial = '<root>&lt;modified&gt;</root>'
      const theirWithSpecial = '<root>&lt;special&gt;</root>'
      mockedmerge.mockReturnValue('<root>&lt;modified&gt;</root>')

      // Act
      const result = sut.tripartXmlMerge(
        ancestorWithSpecial,
        ourWithSpecial,
        theirWithSpecial
      )

      // Assert
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('&lt;modified&gt;')
    })

    it('should correctly handle XML comments', () => {
      // Arrange
      const ancestorWithComment = '<root><!-- original comment --></root>'
      const ourWithComment = '<root><!-- our comment --></root>'
      const theirWithComment = '<root><!-- their comment --></root>'
      mockedmerge.mockReturnValue('<root><!-- merged comment --></root>')

      // Act
      const result = sut.tripartXmlMerge(
        ancestorWithComment,
        ourWithComment,
        theirWithComment
      )

      // Assert
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('<!-- merged comment -->')
    })

    it('empty files should output empty file', () => {
      // Arrange
      const ancestorWithComment = ''
      const ourWithComment = ''
      const theirWithComment = ''
      mockedmerge.mockReturnValue('')

      // Act
      const result = sut.tripartXmlMerge(
        ancestorWithComment,
        ourWithComment,
        theirWithComment
      )

      // Assert
      expect(result).toEqual('')
    })
  })
})
