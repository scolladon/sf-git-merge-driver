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

const mockedMergeObjects = jest.fn()
jest.mock('../../../src/merger/JsonMerger.js', () => {
  return {
    JsonMerger: jest.fn().mockImplementation(() => {
      return {
        mergeObjects: mockedMergeObjects,
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
    it('should merge files successfully when given valid parameters', async () => {
      // Act
      await sut.tripartXmlMerge('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(XMLParser).toHaveBeenCalledTimes(1)
      expect(XMLBuilder).toHaveBeenCalledTimes(1)
      expect(JsonMerger).toHaveBeenCalledTimes(1)
    })

    it('should throw an error when tripartXmlMerge fails', async () => {
      // Arrange
      mockedMergeObjects.mockRejectedValue(
        new Error('Tripart XML merge failed')
      )

      // Act and Assert
      await expect(
        sut.tripartXmlMerge('AncestorFile', 'OurFile', 'TheirFile')
      ).rejects.toThrowError('Tripart XML merge failed')
    })
  })
})
