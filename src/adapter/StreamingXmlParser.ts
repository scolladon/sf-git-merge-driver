import type { Readable } from 'node:stream'
import FlxParser from '@nodable/flexible-xml-parser'
import {
  FLX_OPTIONS,
  type NormalisedParseResult,
  NormalisingOutputBuilderFactory,
} from './NormalisingOutputBuilder.js'

export type { NormalisedParseResult } from './NormalisingOutputBuilder.js'

export interface XmlParser {
  parseString(xml: string): NormalisedParseResult
  parseStream(source: Readable): Promise<NormalisedParseResult>
}

// The upstream @nodable/flexible-xml-parser is not reentrant: one
// FlxParser instance cannot stream two documents concurrently (raises
// ALREADY_STREAMING). A fresh instance per call is cheap — the
// constructor pre-compiles options; no heavy state — and lets the
// driver parse ancestor/ours/theirs in parallel safely.
const newParser = () =>
  new FlxParser({
    ...FLX_OPTIONS,
    OutputBuilder: new NormalisingOutputBuilderFactory(),
  })

export class StreamingXmlParser implements XmlParser {
  parseString(xml: string): NormalisedParseResult {
    return newParser().parse(xml) as NormalisedParseResult
  }

  async parseStream(source: Readable): Promise<NormalisedParseResult> {
    return (await newParser().parseStream(source)) as NormalisedParseResult
  }
}
