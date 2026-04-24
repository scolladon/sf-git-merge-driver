import { PassThrough, Readable } from 'node:stream'
import type { XmlMerger } from '../../src/merger/XmlMerger.js'

// Test helper: wrap the streaming mergeThreeWay in a string-in/string-out
// shape so the large corpus of existing tests written against the old
// sync API can keep asserting against concrete output bytes.
export const mergeXmlStrings = async (
  merger: XmlMerger,
  ancestor: string,
  ours: string,
  theirs: string
): Promise<{ output: string; hasConflict: boolean }> => {
  const sink = new PassThrough()
  const chunks: Buffer[] = []
  sink.on('data', (c: Buffer) => chunks.push(c))
  const collector = new Promise<void>(resolve =>
    sink.on('end', () => resolve())
  )
  const result = await merger.mergeThreeWay(
    Readable.from([ancestor]),
    Readable.from([ours]),
    Readable.from([theirs]),
    sink
  )
  sink.end()
  await collector
  return {
    output: Buffer.concat(chunks).toString('utf8'),
    hasConflict: result.hasConflict,
  }
}
