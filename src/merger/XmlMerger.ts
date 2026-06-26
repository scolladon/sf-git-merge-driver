import type { Readable, Writable } from 'node:stream'
import { TxmlXmlParser } from '../adapter/TxmlXmlParser.js'
import { XmlStreamWriter } from '../adapter/writer/XmlStreamWriter.js'
import type { XmlParser } from '../adapter/XmlParser.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

// When the JSON merge yields no output but BOTH live sides (ours and theirs)
// still carry the root element, rebuild it as an empty element
// (<Root></Root>) so an empty-bodied root round-trips instead of blanking the
// file — a blank file is never valid Salesforce metadata (e.g. an identity
// merge of <SharingRules xmlns="..."/>, which parses to { SharingRules: '' }
// and collapses to no output). Requiring the root on BOTH live sides is
// deliberate: if either side dropped the file entirely (empty document, no
// root key) the deletion stands and nothing is emitted — the driver must
// never resurrect a file a side deleted, nor invent a root from the side
// that left it untouched. The parser guarantees each content object holds at
// most the single root key, so the two live sides' root tags match.
const preserveEmptyRoot = (local: JsonObject, other: JsonObject): JsonArray => {
  const [localRoot] = Object.keys(local)
  const [otherRoot] = Object.keys(other)
  return localRoot !== undefined && otherRoot !== undefined
    ? [{ [localRoot]: '' }]
    : []
}

export class XmlMerger {
  private readonly parser: XmlParser
  private readonly writer: XmlStreamWriter
  private readonly jsonMerger: JsonMerger

  constructor(config: MergeConfig) {
    this.parser = new TxmlXmlParser()
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

    const output =
      mergedResult.output.length > 0
        ? mergedResult.output
        : preserveEmptyRoot(local!.content, other!.content)

    // writeTo short-circuits on an empty array, so no guard is needed here:
    // an empty merge result emits zero bytes either way.
    await this.writer.writeTo(
      out,
      output,
      namespaces,
      eol,
      mergedResult.hasConflict
    )

    return { hasConflict: mergedResult.hasConflict }
  }
}
