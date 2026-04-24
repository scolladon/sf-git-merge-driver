import type { Readable } from 'node:stream'
import FlxParser, { type X2jOptions } from '@nodable/flexible-xml-parser'
import {
  FLX_OPTIONS,
  NormalisingOutputBuilderFactory,
} from './NormalisingOutputBuilder.js'
import type { NormalisedParseResult, XmlParser } from './XmlParser.js'

// The upstream @nodable/flexible-xml-parser is not reentrant: one
// FlxParser instance cannot stream two documents concurrently (raises
// ALREADY_STREAMING). A fresh instance per call is cheap — the
// constructor pre-compiles options; no heavy state — and lets the
// driver parse ancestor/ours/theirs in parallel safely.
// Upstream's `OutputBuilder` option is typed against its own
// ValueParser nominal shape; our factory subclasses CompactBuilderFactory
// at runtime but TS treats them as structurally distinct. Cast through
// `unknown` to bridge the nominal gap — runtime contract is preserved.
const newParser = () => {
  const options = {
    ...FLX_OPTIONS,
    OutputBuilder: new NormalisingOutputBuilderFactory(),
  } as unknown as X2jOptions
  return new FlxParser(options)
}

export class StreamingXmlParser implements XmlParser {
  parseString(xml: string): NormalisedParseResult {
    return newParser().parse(xml) as NormalisedParseResult
  }

  async parseStream(source: Readable): Promise<NormalisedParseResult> {
    return (await newParser().parseStream(source)) as NormalisedParseResult
  }
}
