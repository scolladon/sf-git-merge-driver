// The parser over the frame-per-element scan, balance pass included: the
// reference every parse outcome of the parser is checked against
import type { Readable } from 'node:stream'
import { assertBalancedTags } from '../../../../src/adapter/parser/balanceOracle.js'
import { decodeXmlBytes } from '../../../../src/adapter/parser/decodeXmlBytes.js'
import type {
  NormalisedParseResult,
  XmlParser,
} from '../../../../src/adapter/XmlParser.js'
import { scanDocument } from './scanDocument.js'

// Drain a Readable into a single UTF-8 string, refusing other encodings. The deliberate
// full-buffer approach matches the writer's: SF metadata files are
// KB-MB, and parseString is synchronous, so chunked feeding would add
// no value while complicating error paths.
const readStreamAsUtf8 = async (source: Readable): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const c of source) {
    chunks.push(typeof c === 'string' ? Buffer.from(c) : (c as Buffer))
  }
  return decodeXmlBytes(Buffer.concat(chunks))
}

export class CompactXmlParser implements XmlParser {
  parseString(xml: string): NormalisedParseResult {
    const outcome = scanDocument(xml)
    if (outcome.kind === 'failed') {
      // The balance-family message wins when both passes reject the
      // input, so a malformed file reports the same error either way.
      assertBalancedTags(xml)
      throw new Error(outcome.message)
    }
    if (outcome.needsOracle) assertBalancedTags(xml)
    return outcome.result
  }

  async parseStream(source: Readable): Promise<NormalisedParseResult> {
    return this.parseString(await readStreamAsUtf8(source))
  }
}
