/**
 * Hot loop runner for flamegraph generation via 0x (local only, not CI).
 *
 * Usage:
 *   npx 0x -- node test/perf/flamegraph-runner.mjs [small|medium|large]
 *
 * Runs the streaming pipeline in a tight loop for clean flamegraph profiling.
 */

import { PassThrough } from 'node:stream'
import { StreamingXmlParser } from '../../src/adapter/StreamingXmlParser.js'
import { XmlStreamWriter } from '../../src/adapter/writer/XmlStreamWriter.js'
import { JsonMerger } from '../../src/merger/JsonMerger.js'
import { generateProfileFixtures } from './fixtures/generateFixtures.js'

const size = process.argv[2] || 'medium'
const iterations = Number(process.argv[3]) || 1000

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
  const parser = new StreamingXmlParser()
  const ancestor = parser.parseString(fixtures.ancestor)
  const local = parser.parseString(fixtures.local)
  const other = parser.parseString(fixtures.other)

  const namespaces = {
    ...ancestor.namespaces,
    ...local.namespaces,
    ...other.namespaces,
  }

  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(
    ancestor.content,
    local.content,
    other.content
  )

  if (mergedResult.output.length) {
    const writer = new XmlStreamWriter(config)
    const sink = new PassThrough()
    sink.resume()
    await writer.writeTo(sink, mergedResult.output, namespaces)
    sink.end()
  }
}

// biome-ignore lint/suspicious/noConsole: profiling output
console.info('Done.')
