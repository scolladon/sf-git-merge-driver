/**
 * Hot loop runner for flamegraph generation via 0x (local only, not CI).
 *
 * Usage:
 *   npx 0x -- node test/perf/flamegraph-runner.mjs [small|medium|large]
 *
 * Runs XmlMerger.mergeThreeWay() in a tight loop for clean flamegraph profiling.
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import {
  CDATA_PROP_NAME,
  XML_COMMENT_PROP_NAME,
  XML_DECL,
  XML_INDENT,
} from '../../src/constant/parserConstant.js'
import { ConflictMarkerFormatter } from '../../src/merger/ConflictMarkerFormatter.js'
import { JsonMerger } from '../../src/merger/JsonMerger.js'
import { generateProfileFixtures } from './fixtures/generateFixtures.js'

const size = process.argv[2] || 'medium'
const iterations = Number(process.argv[3]) || 1000

const baseOptions = {
  cdataPropName: CDATA_PROP_NAME,
  commentPropName: XML_COMMENT_PROP_NAME,
  ignoreAttributes: false,
  processEntities: false,
}

const parserOptions = {
  ...baseOptions,
  ignoreDeclaration: true,
  numberParseOptions: { leadingZeros: false, hex: false },
  parseAttributeValue: false,
  parseTagValue: false,
}

const builderOptions = {
  ...baseOptions,
  format: true,
  indentBy: XML_INDENT,
  preserveOrder: true,
}

const config = {
  conflictMarkerSize: 7,
  ancestorConflictTag: 'base',
  localConflictTag: 'ours',
  otherConflictTag: 'theirs',
}

const fixtures = generateProfileFixtures(size)

// biome-ignore lint/suspicious/noConsole: profiling output
console.info(`Running ${iterations} iterations with ${size} fixtures...`)

for (let i = 0; i < iterations; i++) {
  const parser = new XMLParser(parserOptions)
  const ancestorObj = parser.parse(fixtures.ancestor)
  const localObj = parser.parse(fixtures.local)
  const otherObj = parser.parse(fixtures.other)

  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(ancestorObj, localObj, otherObj)

  const builder = new XMLBuilder(builderOptions)
  const mergedXml = builder.build(mergedResult.output)

  if (mergedXml.length) {
    const formatter = new ConflictMarkerFormatter(config)
    let result = XML_DECL.concat(mergedXml)
    result = formatter.handleSpecialEntities(result)
    formatter.correctConflictIndent(result)
  }
}

// biome-ignore lint/suspicious/noConsole: profiling output
console.info('Done.')
