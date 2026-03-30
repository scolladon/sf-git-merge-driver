import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

// Mocks bypass XML parsing/building to isolate orchestration logic.
// Real XML handling is covered by integration tests.
vi.mock('fast-xml-parser', () => {
  const XMLParser = vi.fn()
  XMLParser.prototype.parse = (xml: string) => xml
  const XMLBuilder = vi.fn()
  XMLBuilder.prototype.build = (obj: unknown) => obj
  return { XMLParser, XMLBuilder }
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
    it('given non-empty input when merging then output includes XML declaration', () => {
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
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result.hasConflict).toBe(false)
    })

    it('given XML comments when merging then preserves comments in output', () => {
      // Arrange
      mockedmerge.mockReturnValue({
        output: '<root><!-- merged comment --></root>',
        hasConflict: false,
      })

      // Act
      const result = sut.mergeThreeWay(
        '<root><!-- original comment --></root>',
        '<root><!-- our comment --></root>',
        '<root><!-- their comment --></root>'
      )

      // Assert
      expect(result.output).toContain('<!-- merged comment -->')
      expect(result.hasConflict).toBe(false)
    })

    it('given empty files when merging then returns empty output', () => {
      // Arrange
      mockedmerge.mockReturnValue({ output: '', hasConflict: false })

      // Act
      const result = sut.mergeThreeWay('', '', '')

      // Assert
      expect(result.output).toEqual('')
      expect(result.hasConflict).toBe(false)
    })
  })
})
