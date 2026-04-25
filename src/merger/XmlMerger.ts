import type { Readable, Writable } from 'node:stream'
import { StreamingXmlParser } from '../adapter/StreamingXmlParser.js'
import { XmlStreamWriter } from '../adapter/writer/XmlStreamWriter.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonObject } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

export class XmlMerger {
  private readonly parser: StreamingXmlParser
  private readonly writer: XmlStreamWriter
  private readonly jsonMerger: JsonMerger

  constructor(config: MergeConfig) {
    this.parser = new StreamingXmlParser()
    this.writer = new XmlStreamWriter(config)
    this.jsonMerger = new JsonMerger(config)
  }

  @log('XmlMerger')
  async mergeThreeWay(
    ancestor: Readable,
    ours: Readable,
    theirs: Readable,
    out: Writable,
    eol: '\n' | '\r\n' = '\n'
  ): Promise<{ hasConflict: boolean }> {
    // allSettled guarantees every parseStream promise terminates (by
    // success OR failure) before we rethrow. Matches the fd-release
    // pattern documented in MergeDriver.ts and protects Windows from
    // ENOTEMPTY on still-open handles.
    const results = await Promise.allSettled([
      this.parser.parseStream(ancestor),
      this.parser.parseStream(ours),
      this.parser.parseStream(theirs),
    ])
    const failure = results.find(r => r.status === 'rejected')
    if (failure) throw (failure as PromiseRejectedResult).reason
    const [anc, local, other] = (
      results as PromiseFulfilledResult<{
        content: JsonObject
        namespaces: JsonObject
      }>[]
    ).map(r => r.value)

    const namespaces = mergeNamespaces(
      anc!.namespaces,
      local!.namespaces,
      other!.namespaces
    )

    const mergedResult = this.jsonMerger.mergeThreeWay(
      anc!.content,
      local!.content,
      other!.content
    )

    if (mergedResult.output.length) {
      await this.writer.writeTo(
        out,
        mergedResult.output,
        namespaces,
        eol,
        mergedResult.hasConflict
      )
    }

    return { hasConflict: mergedResult.hasConflict }
  }
}
