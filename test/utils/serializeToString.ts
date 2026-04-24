import { PassThrough } from 'node:stream'
import type { XmlStreamWriter } from '../../src/adapter/writer/XmlStreamWriter.js'
import type { JsonArray, JsonObject } from '../../src/types/jsonTypes.js'

// Test-only helper: run writeTo into a PassThrough and concatenate the
// chunks into a single string. Production code always uses writeTo
// directly; this helper exists solely so golden-file comparisons can
// stay synchronous-feeling.
export const serializeToString = async (
  writer: XmlStreamWriter,
  ordered: JsonArray,
  namespaces: JsonObject
): Promise<string> => {
  const sink = new PassThrough()
  const chunks: Buffer[] = []
  sink.on('data', (c: Buffer) => chunks.push(c))
  await writer.writeTo(sink, ordered, namespaces)
  return Buffer.concat(chunks).toString('utf8')
}
