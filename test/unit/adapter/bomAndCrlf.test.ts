import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { StreamingXmlParser } from '../../../src/adapter/StreamingXmlParser.js'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  stream.on('data', (c: Buffer) => chunks.push(c))
  await new Promise<void>(resolve => stream.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

const BOM = '﻿'

describe('BOM + CRLF edge cases', () => {
  describe('given a UTF-8 BOM prefixing the XML', () => {
    it('when parsed then the content is unaffected by the BOM', async () => {
      const parser = new StreamingXmlParser()
      const withBom = `${BOM}<?xml version="1.0"?><Root><v>x</v></Root>`
      const withoutBom = `<?xml version="1.0"?><Root><v>x</v></Root>`
      const a = await parser.parseStream(Readable.from([withBom]))
      const b = await parser.parseStream(Readable.from([withoutBom]))
      expect(a).toEqual(b)
    })
  })

  describe('given CRLF EOL target and a conflicting three-way merge', () => {
    it('when merged with eol=\\r\\n then all LFs including conflict markers become CRLF', async () => {
      const merger = new XmlMerger(defaultConfig)
      const base = `<?xml version="1.0"?><R><v>base</v></R>`
      const ours = `<?xml version="1.0"?><R><v>ours</v></R>`
      const theirs = `<?xml version="1.0"?><R><v>theirs</v></R>`
      const sink = new PassThrough()
      const collector = collect(sink)
      await merger.mergeThreeWay(
        Readable.from([base]),
        Readable.from([ours]),
        Readable.from([theirs]),
        sink,
        '\r\n'
      )
      sink.end()
      const out = await collector
      // Every newline must be CRLF; no bare LF survives.
      expect(out).toContain('\r\n')
      expect(out).not.toMatch(/(?<!\r)\n/)
      // Conflict markers are present and their line endings are CRLF.
      expect(out).toContain('<<<<<<<')
      expect(out).toContain('=======')
      expect(out).toContain('>>>>>>>')
    })
  })

  describe('given the LF variant of the same merge', () => {
    it('when merged with eol=\\n then no CRLF appears in output', async () => {
      const merger = new XmlMerger(defaultConfig)
      const base = `<?xml version="1.0"?><R><v>base</v></R>`
      const ours = `<?xml version="1.0"?><R><v>ours</v></R>`
      const theirs = `<?xml version="1.0"?><R><v>theirs</v></R>`
      const sink = new PassThrough()
      const collector = collect(sink)
      await merger.mergeThreeWay(
        Readable.from([base]),
        Readable.from([ours]),
        Readable.from([theirs]),
        sink
      )
      sink.end()
      const out = await collector
      expect(out).not.toContain('\r')
      expect(out).toContain('\n')
    })
  })
})
