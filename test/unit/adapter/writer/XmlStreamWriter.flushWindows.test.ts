import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { JsonArray } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'
const FLUSH_WINDOW = 16 * 1024
const TOTAL_ITEMS = 1000
// Each item is a line of 28 characters after `<?xml…?>\n<Root>`. The first
// one is padded so that, after ITEMS_BEFORE_EDGE items, the line break that
// follows sits on the last character of a window (padding 14) or on the first
// character of the next one (padding 15)
const ITEMS_BEFORE_EDGE = 583
const PAD_ENDING_THE_WINDOW = 14
const PAD_STARTING_THE_WINDOW = 15

const itemOf = (index: number, pad: number): { item: string } => ({
  item: `value-${String(index).padStart(4, '0')}${'p'.repeat(index === 0 ? pad : 0)}`,
})

const itemsOf = (count: number, pad: number): JsonArray =>
  Array.from({ length: count }, (_, index) => itemOf(index, pad))

const documentOf = (items: JsonArray): string => {
  const lines = items.map(
    child => `\n    <item>${(child as { item: string }).item}</item>`
  )
  return `${DECL}\n<Root>${lines.join('')}\n</Root>\n`
}

const writesOf = async (tree: JsonArray): Promise<string[]> => {
  const writes: string[] = []
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done): void {
      writes.push(chunk.toString('utf8'))
      done()
    },
  })
  await new XmlStreamWriter(defaultConfig).writeTo(sink, tree, {})
  return writes
}

describe('XmlStreamWriter flush windows', () => {
  describe('given a document whose first window ends on a line break', () => {
    it('when written then the first write is the full window and the rest follows in one write', async () => {
      // Arrange
      const items = itemsOf(TOTAL_ITEMS, PAD_ENDING_THE_WINDOW)
      const expected = documentOf(items)

      // Act
      const result = await writesOf([{ Root: items }])

      // Assert
      expect(result.map(write => write.length)).toEqual([
        FLUSH_WINDOW,
        expected.length - FLUSH_WINDOW,
      ])
      expect(result.join('')).toBe(expected)
    })
  })

  describe('given a conflicted document whose second window starts with a line break', () => {
    it('when written then no whitespace-only line is left at the window edge', async () => {
      // Arrange
      const block = {
        __conflict: true as const,
        local: [{ v: 'L' }],
        ancestor: [],
        other: [{ v: 'O' }],
      }
      const items = itemsOf(ITEMS_BEFORE_EDGE, PAD_STARTING_THE_WINDOW)
      const tree = [{ Root: [...items, block] }] as JsonArray

      // Act
      const result = (await writesOf(tree)).join('')

      // Assert
      expect(result.split('\n').filter(line => line.trim() === '')).toEqual([
        '',
      ])
    })
  })
})
