import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../../src/merger/XmlMerger.js'
import { listFixtures } from '../../../utils/goldenFile.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  stream.on('data', (c: Buffer) => chunks.push(c))
  await new Promise<void>(resolve => stream.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

describe('merger parity — mergeStreams vs expected.xml', () => {
  const fixtures = listFixtures().filter(
    f =>
      f.inputs.ancestor !== undefined &&
      f.inputs.ours !== undefined &&
      f.inputs.theirs !== undefined
  )

  for (const fixture of fixtures) {
    describe(`given fixture ${fixture.id}`, () => {
      it('when mergeStreams is run then output bytes match expected.xml', async () => {
        const merger = new XmlMerger(defaultConfig)
        const sink = new PassThrough()
        const collector = collect(sink)
        await merger.mergeStreams(
          Readable.from([fixture.inputs.ancestor as string]),
          Readable.from([fixture.inputs.ours as string]),
          Readable.from([fixture.inputs.theirs as string]),
          sink
        )
        sink.end()
        const out = await collector
        const expected =
          fixture.parity.mode === 'divergence' && fixture.expectedNew
            ? fixture.expectedNew
            : fixture.expectedCurrent
        expect(out).toBe(expected)
      })
    })
  }
})
