import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { StreamingXmlParser } from '../../../src/adapter/StreamingXmlParser.js'

describe('StreamingXmlParser', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://x"><v>1</v></Root>`

  describe('given an XML string', () => {
    it('when parseString then returns normalised content + namespaces', () => {
      const sut = new StreamingXmlParser()
      const result = sut.parseString(xml)
      expect(result.content).toEqual({ Root: { v: '1' } })
      expect(result.namespaces).toEqual({ '@_xmlns': 'http://x' })
    })
  })

  describe('given a Readable stream of XML bytes', () => {
    it('when parseStream then produces the same tree as parseString', async () => {
      const sut = new StreamingXmlParser()
      const fromString = sut.parseString(xml)
      const stream = Readable.from([xml])
      const fromStream = await sut.parseStream(stream)
      expect(fromStream).toEqual(fromString)
    })
  })

  describe('given three concurrent parseStream calls', () => {
    it('when awaited in parallel then all produce correct trees', async () => {
      const sut = new StreamingXmlParser()
      const inputs = [
        `<?xml version="1.0"?><A><v>1</v></A>`,
        `<?xml version="1.0"?><B><v>2</v></B>`,
        `<?xml version="1.0"?><C><v>3</v></C>`,
      ]
      const results = await Promise.all(
        inputs.map(s => sut.parseStream(Readable.from([s])))
      )
      expect(results[0]!.content).toEqual({ A: { v: '1' } })
      expect(results[1]!.content).toEqual({ B: { v: '2' } })
      expect(results[2]!.content).toEqual({ C: { v: '3' } })
    })
  })
})
