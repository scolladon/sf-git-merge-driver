import { PassThrough, Readable } from 'node:stream'
import { TxmlXmlParser } from '../../../src/adapter/TxmlXmlParser.js'
import { XmlStreamWriter } from '../../../src/adapter/writer/XmlStreamWriter.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { JsonObject } from '../../../src/types/jsonTypes.js'
import type { PhaseTimer } from './PhaseTimer.js'

export interface InstrumentedResult {
  readonly output: string
  readonly hasConflict: boolean
  readonly inputSizeBytes: number
  readonly outputSizeBytes: number
}

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

export const instrumentedMerge = async (
  ancestorContent: string,
  localContent: string,
  otherContent: string,
  config: MergeConfig,
  timer: PhaseTimer
): Promise<InstrumentedResult> => {
  const inputSizeBytes =
    Buffer.byteLength(ancestorContent) +
    Buffer.byteLength(localContent) +
    Buffer.byteLength(otherContent)

  const parser = new TxmlXmlParser()
  const writer = new XmlStreamWriter(config)
  const jsonMerger = new JsonMerger(config)

  timer.startPhase('xml-parse')
  const [ancestor, local, other] = await Promise.all([
    parser.parseStream(Readable.from([ancestorContent])),
    parser.parseStream(Readable.from([localContent])),
    parser.parseStream(Readable.from([otherContent])),
  ])
  timer.endPhase('xml-parse')

  timer.startPhase('json-merge')
  const mergedResult = jsonMerger.mergeThreeWay(
    ancestor.content,
    local.content,
    other.content
  )
  const namespaces = mergeNamespaces(
    ancestor.namespaces,
    local.namespaces,
    other.namespaces
  )
  timer.endPhase('json-merge')

  timer.startPhase('xml-serialize')
  const sink = new PassThrough()
  const chunks: Buffer[] = []
  sink.on('data', (c: Buffer) => chunks.push(c))
  if (mergedResult.output.length) {
    await writer.writeTo(sink, mergedResult.output, namespaces)
  }
  sink.end()
  const output = Buffer.concat(chunks).toString('utf8')
  timer.endPhase('xml-serialize')

  return {
    output,
    hasConflict: mergedResult.hasConflict,
    inputSizeBytes,
    outputSizeBytes: Buffer.byteLength(output),
  }
}
