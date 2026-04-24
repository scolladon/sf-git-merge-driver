import { CompactBuilder, CompactBuilderFactory } from '@nodable/compact-builder'
import type { X2jOptions } from '@nodable/flexible-xml-parser'
import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
} from '../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../types/jsonTypes.js'
import type { NormalisedParseResult } from './XmlParser.js'

export type { NormalisedParseResult } from './XmlParser.js'

// Parser options shared across every parseString / parseStream invocation.
// valueParsers:[] keeps text and attribute values verbatim — matches the
// current pipeline. Without this, defaults coerce "1" → 1, "true" → true.
// Cast because upstream X2jOptions .d.ts omits valueParsers from the
// tags/attributes option shapes even though the runtime consumes them.
export const FLX_OPTIONS = {
  skip: { attributes: false, declaration: true },
  tags: { valueParsers: [] },
  attributes: { valueParsers: [] },
  nameFor: { cdata: CDATA_PROP_NAME, comment: XML_COMMENT_PROP_NAME },
  doctypeOptions: { enabled: false },
} as X2jOptions

const XMLNS = 'xmlns'
const VERSION = 'version'
const ENCODING = 'encoding'

// Subclass CompactBuilder so that normalisation and namespace splitting
// happen in-place as the tree is built — no post-walk clones.
class NormalisingOutputBuilder extends CompactBuilder {
  private readonly nsBucket: JsonObject = {}

  override addAttribute(name: string, value: unknown, matcher?: unknown): void {
    // Drop leaked XML-declaration attributes at any depth. Matches the
    // defensive `normalizeParsed` behaviour.
    if (name === VERSION || name === ENCODING) return

    // Attribute-handling order in the upstream parser: all attributes of
    // an element fire via addAttribute BEFORE addElement is invoked for
    // that element. So at addAttribute time, `tagsStack.length` equals
    // the depth of the PARENT element already on the stack, not the
    // depth of the element currently being opened.
    //
    // tagsStack.length === 0 → the sentinel is the parent → these are
    // the about-to-open ROOT element's attributes (or leaked XML-decl
    // attrs, already filtered above).
    //
    // tagsStack.length >= 1 → these are a child element's attributes.
    //
    // Route root-element xmlns* into the namespaces bucket; leave
    // non-root xmlns* on the element so round-trip is lossless.
    if (
      (name === XMLNS || name.startsWith(`${XMLNS}:`)) &&
      this.tagsStack.length === 0
    ) {
      const prefixed =
        this.options.attributes.prefix + name + this.options.attributes.suffix
      this.nsBucket[prefixed] = value as JsonValue
      return
    }

    super.addAttribute(name, value, matcher)
  }

  // CompactBuilder._addChild converts a string-valued `value` into
  // `{#text: <string>}` before attaching a child. When the string is
  // empty — which happens whenever an element has NO attributes kept
  // (e.g. after filtering @_version / @_encoding) and its first child
  // is a comment or CDATA — this produces a spurious `#text: ''` key
  // that the current FlxXmlParser pipeline does not emit. Collapse
  // the empty case to an object up front so the conversion is skipped.
  override _addChild(key: string, val: unknown): void {
    if (this.value === '') this.value = {}
    super._addChild(key, val)
  }

  // The parser calls getOutput() directly to return its result, so we
  // return the full NormalisedParseResult here rather than adding a
  // separate build() method.
  override getOutput(): NormalisedParseResult {
    const content = super.getOutput() as JsonObject
    return { content, namespaces: { ...this.nsBucket } }
  }
}

export class NormalisingOutputBuilderFactory extends CompactBuilderFactory {
  constructor() {
    // Match the current FlxXmlParser: no factory options → library
    // defaults (attribute prefix '@_', valueParsers from parser options).
    super()
  }

  override getInstance(
    parserOptions: unknown,
    readonlyMatcher: unknown
  ): NormalisingOutputBuilder {
    // We replicate the parent's getInstance body because we need to
    // construct our OWN subclass (CompactBuilder's constructor takes
    // the valParsers map as an argument). Under the current
    // parser-options `valueParsers: []`, the registered parsers are
    // never consulted — but spreading commonValParsers preserves the
    // contract the upstream library documents for custom output
    // builders. If a future release activates any default parser, the
    // shared instance stays in sync with parent behaviour.
    const self = this as unknown as {
      resetValueParsers(): void
      commonValParsers: Record<string, unknown>
      options: unknown
    }
    self.resetValueParsers()
    return new NormalisingOutputBuilder(
      parserOptions,
      self.options,
      { ...self.commonValParsers },
      readonlyMatcher
    )
  }
}
