import type { Readable, Writable } from 'node:stream'
import { CompactXmlParser } from '../adapter/parser/CompactXmlParser.js'
import { XmlStreamWriter } from '../adapter/writer/XmlStreamWriter.js'
import type { NormalisedParseResult, XmlParser } from '../adapter/XmlParser.js'
import type { RootAttributeSides } from '../adapter/XmlSerializer.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { isDeleteVersusEdit, wholeFileConflict } from './fileDeletion.js'
import { JsonMerger } from './JsonMerger.js'
import { mergeRootAttributes } from './rootAttributes.js'

// A side that dropped the whole file carries an empty root-attribute bucket
// for the trivial reason that it has no root element to carry them on — not
// because it removed them. Reading that emptiness as a removal erases an
// attribute (typically the xmlns) the surviving side still declares. The ancestor is never
// substituted: a rootless ancestor is the "file added on both sides" case,
// where an empty bucket genuinely means the attribute did not exist before.
// `content` is empty exactly when the document has no root element.
const rootAttributesOf = (
  side: NormalisedParseResult,
  ancestor: NormalisedParseResult
): JsonObject =>
  Object.keys(side.content).length > 0
    ? side.rootAttributes
    : ancestor.rootAttributes

// The root tag is the metadata type: Salesforce never renames it. A rename
// would merge into a second root or a side no marker can show, so the merge
// is refused, which leaves ours untouched. A side without a root dropped the
// file and renames nothing.
const ONE_ROOT_TAG = 1
const assertOneRootTag = (...sides: NormalisedParseResult[]): void => {
  const tags = new Set(sides.flatMap(side => Object.keys(side.content)))
  if (tags.size <= ONE_ROOT_TAG) return
  throw new Error(
    'XML merge error: the documents do not share one root element'
  )
}

interface Resolution {
  readonly output: JsonArray
  readonly attributes: JsonObject
  readonly contested?: RootAttributeSides | undefined
  readonly hasConflict: boolean
}

export class XmlMerger {
  private readonly parser: XmlParser
  private readonly writer: XmlStreamWriter
  private readonly jsonMerger: JsonMerger

  constructor(config: MergeConfig) {
    this.parser = new CompactXmlParser()
    this.writer = new XmlStreamWriter(config)
    this.jsonMerger = new JsonMerger(config)
  }

  // A deletion against an edit is decided on the whole file, before the body
  // and the root attributes get a say: neither can absorb the other side.
  private resolve(
    anc: NormalisedParseResult,
    local: NormalisedParseResult,
    other: NormalisedParseResult
  ): Resolution {
    if (isDeleteVersusEdit(anc, local, other)) {
      const { output, hasConflict } = wholeFileConflict(anc, local, other)
      return { output, attributes: anc.rootAttributes, hasConflict }
    }
    const { attributes, contested } = mergeRootAttributes(
      anc.rootAttributes,
      rootAttributesOf(local, anc),
      rootAttributesOf(other, anc)
    )
    const merged = this.jsonMerger.mergeThreeWay(
      anc.content,
      local.content,
      other.content
    )
    return {
      output: merged.output,
      attributes,
      contested,
      hasConflict: merged.hasConflict || contested !== undefined,
    }
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
    assertOneRootTag(anc!, local!, other!)

    const { output, attributes, contested, hasConflict } = this.resolve(
      anc!,
      local!,
      other!
    )

    // writeTo short-circuits on an empty array, so no guard is needed here:
    // an empty merge result emits zero bytes either way.
    await this.writer.writeTo(out, output, attributes, {
      eol,
      hasConflict,
      contested,
      sides: {
        local: rootAttributesOf(local!, anc!),
        ancestor: anc!.rootAttributes,
        other: rootAttributesOf(other!, anc!),
      },
    })

    return { hasConflict }
  }
}
