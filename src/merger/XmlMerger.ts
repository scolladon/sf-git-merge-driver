import type { Readable, Writable } from 'node:stream'
import { FlxXmlParser } from '../adapter/FlxXmlParser.js'
import { FxpXmlSerializer } from '../adapter/FxpXmlSerializer.js'
import { StreamingXmlParser } from '../adapter/StreamingXmlParser.js'
import { XmlStreamWriter } from '../adapter/writer/XmlStreamWriter.js'
import type { XmlParser } from '../adapter/XmlParser.js'
import type { XmlSerializer } from '../adapter/XmlSerializer.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonObject } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

export class XmlMerger {
  private readonly parser: XmlParser
  private readonly serializer: XmlSerializer
  private readonly streamingParser: StreamingXmlParser
  private readonly streamWriter: XmlStreamWriter
  private readonly jsonMerger: JsonMerger

  constructor(config: MergeConfig) {
    this.parser = new FlxXmlParser()
    this.serializer = new FxpXmlSerializer(config)
    this.streamingParser = new StreamingXmlParser()
    this.streamWriter = new XmlStreamWriter(config)
    this.jsonMerger = new JsonMerger(config)
  }

  @log('XmlMerger')
  mergeThreeWay(
    ancestorContent: string,
    ourContent: string,
    theirContent: string
  ): { output: string; hasConflict: boolean } {
    const ancestor = this.parser.parse(ancestorContent)
    const local = this.parser.parse(ourContent)
    const other = this.parser.parse(theirContent)

    const namespaces = mergeNamespaces(
      ancestor.namespaces,
      local.namespaces,
      other.namespaces
    )

    const mergedResult = this.jsonMerger.mergeThreeWay(
      ancestor.content,
      local.content,
      other.content
    )

    return {
      output: mergedResult.output.length
        ? this.serializer.serialize(mergedResult.output, namespaces)
        : '',
      hasConflict: mergedResult.hasConflict,
    }
  }

  // Streaming-pipeline sibling of mergeThreeWay (design §6.5). Kept
  // side-by-side with the legacy method until C4 wires MergeDriver
  // across, then mergeThreeWay is deleted in C6.
  @log('XmlMerger')
  async mergeStreams(
    ancestor: Readable,
    ours: Readable,
    theirs: Readable,
    out: Writable,
    eol: '\n' | '\r\n' = '\n'
  ): Promise<{ hasConflict: boolean }> {
    // allSettled guarantees every parseStream promise terminates (by
    // success OR failure) before we rethrow. Matches the fd-release
    // pattern documented in MergeDriver.ts:18-21 and protects Windows
    // from ENOTEMPTY on still-open handles.
    const results = await Promise.allSettled([
      this.streamingParser.parseStream(ancestor),
      this.streamingParser.parseStream(ours),
      this.streamingParser.parseStream(theirs),
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
      await this.streamWriter.writeTo(out, mergedResult.output, namespaces, eol)
    }

    return { hasConflict: mergedResult.hasConflict }
  }
}
