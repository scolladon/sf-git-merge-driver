import { describe, expect, it, vi } from 'vitest'
import {
  type ScanOutcome,
  scanDocument,
} from '../../../../src/adapter/parser/scanDocument.js'
import type { JsonObject } from '../../../../src/types/jsonTypes.js'

// Every open element accumulates into one frame: counting the constructions
// counts the elements that were not taken in one step.
const constructions = vi.hoisted(() => ({ count: 0 }))

vi.mock(
  '../../../../src/adapter/parser/ElementFrame.js',
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import('../../../../src/adapter/parser/ElementFrame.js')
      >()
    class Counted extends original.ElementFrame {
      constructor(
        ...args: ConstructorParameters<typeof original.ElementFrame>
      ) {
        super(...args)
        constructions.count++
      }
    }
    return { ...original, ElementFrame: Counted }
  }
)

const framesBuiltBy = (
  xml: string
): { readonly frames: number; readonly outcome: ScanOutcome } => {
  constructions.count = 0
  const outcome = scanDocument(xml)
  return { frames: constructions.count, outcome }
}

const parsedContent = (content: JsonObject): ScanOutcome => ({
  kind: 'parsed',
  result: { content, rootAttributes: {} },
  needsOracle: false,
})

describe('scanDocument dispatch', () => {
  describe('given two text leaves under the root', () => {
    it('when scanned then only the sentinel and root frames are built', () => {
      // Arrange
      const sut = '<a><b>x</b><c>y</c></a>'

      // Act
      const result = framesBuiltBy(sut)

      // Assert
      expect(result.frames).toBe(2)
      expect(result.outcome).toEqual(parsedContent({ a: { b: 'x', c: 'y' } }))
    })
  })

  describe('given a text leaf with an attribute under the root', () => {
    it('when scanned then the leaf keeps its frame', () => {
      // Arrange
      const sut = '<a><b x="1">x</b></a>'

      // Act
      const result = framesBuiltBy(sut)

      // Assert
      expect(result.frames).toBe(3)
    })
  })

  describe('given text followed by an open tag whose name ends with the element name', () => {
    it('when scanned then the element keeps its frame', () => {
      // Arrange
      const sut = '<a><b>x<cb>y</cb></b></a>'

      // Act
      const result = framesBuiltBy(sut)

      // Assert
      expect(result.frames).toBe(3)
      expect(result.outcome).toEqual(
        parsedContent({ a: { b: { cb: 'y', '#text': 'x' } } })
      )
    })
  })

  describe('given a root that holds only text', () => {
    it('when scanned then the root keeps its frame', () => {
      // Arrange
      const sut = '<a>x</a>'

      // Act
      const result = framesBuiltBy(sut)

      // Assert
      expect(result.frames).toBe(2)
      expect(result.outcome).toEqual(parsedContent({ a: 'x' }))
    })
  })
})
