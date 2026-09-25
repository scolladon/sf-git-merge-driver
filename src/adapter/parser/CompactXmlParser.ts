import type { Readable } from 'node:stream'
import type { NormalisedParseResult, XmlParser } from '../XmlParser.js'
import { assertBalancedTags } from './balanceOracle.js'
import { scanDocument } from './scanDocument.js'

// Drain a Readable into a single UTF-8 string. The deliberate
// full-buffer approach matches the writer's: SF metadata files are
// KB-MB, and parseString is synchronous, so chunked feeding would add
// no value while complicating error paths.
const readStreamAsUtf8 = async (source: Readable): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const c of source) {
    // Stryker disable next-line ConditionalExpression: Buffer.from copies a Buffer chunk byte for byte
    chunks.push(typeof c === 'string' ? Buffer.from(c) : (c as Buffer))
  }
  return Buffer.concat(chunks).toString('utf8')
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
    // Stryker disable next-line ConditionalExpression: the scanner clears needsOracle only where the oracle passes
    if (outcome.needsOracle) assertBalancedTags(xml)
    return outcome.result
  }

  async parseStream(source: Readable): Promise<NormalisedParseResult> {
    return this.parseString(await readStreamAsUtf8(source))
  }
}
