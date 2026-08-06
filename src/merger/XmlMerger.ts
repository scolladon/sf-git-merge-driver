import type { Readable, Writable } from 'node:stream'
import { TxmlXmlParser } from '../adapter/TxmlXmlParser.js'
import { XmlStreamWriter } from '../adapter/writer/XmlStreamWriter.js'
import type { NormalisedParseResult, XmlParser } from '../adapter/XmlParser.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'
import { JsonMerger } from './JsonMerger.js'

// Root xmlns* attributes live in a bucket parsed separately from `content`
// (see TxmlXmlParser.splitRootAttrs) and never reach MergeOrchestrator, so
// they need their own three-way resolution instead of inheriting one for
// free. Per key: unchanged-on-one-side defers to whatever the other side
// did (add, change or remove); both sides agreeing (including both
// removing it) keeps that agreement. A namespace value has no way to carry
// zdiff3 markers without producing invalid XML (`xmlns="<<<<<<< ours..."`),
// so a genuine three-way divergence — all three different, no pair
// agreeing — can't become a real conflict; it keeps `local` (protects the
// developer's own change from being silently overwritten by `other`,
// unlike the previous `Object.assign({}, ancestor, local, other)` which
// always let `other` win even when only `local` had changed) and logs so
// the discarded alternative isn't completely invisible.
const resolveNamespaceValue = (
  key: string,
  ancestor: JsonValue | undefined,
  local: JsonValue | undefined,
  other: JsonValue | undefined
): JsonValue | undefined => {
  if (ancestor === local) return other // only other changed (added/edited/removed)
  if (ancestor === other) return local // only local changed
  if (local === other) return local // both changed to the same value
  // Genuine three-way divergence, no pair agreeing: keep local and log —
  // see the function-level comment for why this can't become a real
  // conflict.
  Logger.warn(`xmlns divergence on ${key}; keeping local`, {
    ancestor,
    local,
    other,
  })
  return local
}

const mergeNamespaces = (
  ancestor: JsonObject,
  local: JsonObject,
  other: JsonObject
): JsonObject => {
  const keys = new Set([
    ...Object.keys(ancestor),
    ...Object.keys(local),
    ...Object.keys(other),
  ])
  const result: JsonObject = {}
  for (const key of keys) {
    const resolved = resolveNamespaceValue(
      key,
      ancestor[key],
      local[key],
      other[key]
    )
    if (resolved !== undefined) result[key] = resolved
  }
  return result
}

// A side that dropped the whole file carries an empty namespaces bucket for
// the trivial reason that it has no root element to carry them on — not
// because it removed the xmlns. Reading that emptiness as a removal erases a
// namespace the surviving side still declares. The ancestor is never
// substituted: a rootless ancestor is the "file added on both sides" case,
// where an empty bucket genuinely means the namespace did not exist before.
// `content` is empty exactly when the document has no root element.
const namespacesOf = (
  side: NormalisedParseResult,
  ancestor: NormalisedParseResult
): JsonObject =>
  Object.keys(side.content).length > 0 ? side.namespaces : ancestor.namespaces

// When the JSON merge yields no output but BOTH live sides (ours and theirs)
// still carry the root element, rebuild it as an empty element
// (<Root/>) so an empty-bodied root round-trips instead of blanking the
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
      results as PromiseFulfilledResult<NormalisedParseResult>[]
    ).map(r => r.value)

    const namespaces = mergeNamespaces(
      anc!.namespaces,
      namespacesOf(local!, anc!),
      namespacesOf(other!, anc!)
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
