import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

vi.mock('../../../src/adapter/FlxXmlParser.js', () => {
  const FlxXmlParser = vi.fn()
  FlxXmlParser.prototype.parse = (xml: string) => ({
    content: xml,
    namespaces: {},
  })
  return { FlxXmlParser }
})

vi.mock('../../../src/adapter/FxpXmlSerializer.js', () => {
  const FxpXmlSerializer = vi.fn()
  FxpXmlSerializer.prototype.serialize = (output: unknown) => output
  return { FxpXmlSerializer }
})

const mockedmerge = vi.fn()
vi.mock('../../../src/merger/JsonMerger.js', () => {
  const JsonMerger = vi.fn()
  JsonMerger.prototype.mergeThreeWay = (...args: unknown[]) =>
    mockedmerge(...args)
  return { JsonMerger }
})

describe('XmlMerger', () => {
  let sut: XmlMerger

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new XmlMerger(defaultConfig)
  })

  describe('mergeThreeWay', () => {
    it('given valid inputs when merging then delegates to JsonMerger with config', () => {
      // Arrange
      mockedmerge.mockReturnValue({
        output: 'MergedContent',
        hasConflict: false,
      })

      // Act
      sut.mergeThreeWay('AncestorFile', 'OurFile', 'TheirFile')

      // Assert
      expect(JsonMerger).toHaveBeenCalledWith(defaultConfig)
    })

    it('given JsonMerger throws when merging then propagates error', () => {
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

  describe('XML output formatting', () => {
    it('given non-empty output when merging then serializer is called', () => {
      // Arrange
      mockedmerge.mockReturnValue({
        output: '<root>&lt;modified&gt;</root>',
        hasConflict: false,
      })

      // Act
      const result = sut.mergeThreeWay(
        '<root>&lt;special&gt;</root>',
        '<root>&lt;modified&gt;</root>',
        '<root>&lt;special&gt;</root>'
      )

      // Assert
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBeTruthy()
    })

    it('given empty output when merging then returns empty string', () => {
      // Arrange
      mockedmerge.mockReturnValue({ output: '', hasConflict: false })

      // Act
      const result = sut.mergeThreeWay('', '', '')

      // Assert
      expect(result.output).toEqual('')
      expect(result.hasConflict).toBe(false)
    })

    it('given empty array output when merging then returns empty string', () => {
      // Arrange
      mockedmerge.mockReturnValue({ output: [], hasConflict: false })

      // Act
      const result = sut.mergeThreeWay('', '', '')

      // Assert
      expect(result.output).toEqual('')
      expect(result.hasConflict).toBe(false)
    })
  })
})
