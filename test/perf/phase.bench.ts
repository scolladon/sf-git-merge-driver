import { PassThrough } from 'node:stream'
import { bench, describe } from 'vitest'
import { StreamingXmlParser } from '../../src/adapter/StreamingXmlParser.js'
import { XmlStreamWriter } from '../../src/adapter/writer/XmlStreamWriter.js'
import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../src/constant/conflictConstant.js'
import { JsonMerger } from '../../src/merger/JsonMerger.js'
import type { MergeConfig } from '../../src/types/conflictTypes.js'
import type { JsonObject } from '../../src/types/jsonTypes.js'
import { generateProfileFixtures } from './fixtures/generateFixtures.js'

const config: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const fixtures = generateProfileFixtures(size)
  const parser = new StreamingXmlParser()

  // Pre-warm: parse once outside the bench to set up merged tree + ns.
  const ancestor = parser.parseString(fixtures.ancestor)
  const local = parser.parseString(fixtures.local)
  const other = parser.parseString(fixtures.other)

  const namespaces = mergeNamespaces(
    ancestor.namespaces,
    local.namespaces,
    other.namespaces
  )

  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(
    ancestor.content,
    local.content,
    other.content
  )

  describe(`phase-parse-${size}`, () => {
    bench(`parse-${size}`, () => {
      const p = new StreamingXmlParser()
      p.parseString(fixtures.ancestor)
      p.parseString(fixtures.local)
      p.parseString(fixtures.other)
    })
  })

  describe(`phase-merge-${size}`, () => {
    bench(`merge-${size}`, () => {
      const jm = new JsonMerger(config)
      jm.mergeThreeWay(ancestor.content, local.content, other.content)
    })
  })

  describe(`phase-serialize-${size}`, () => {
    bench(`serialize-${size}`, async () => {
      const w = new XmlStreamWriter(config)
      const sink = new PassThrough()
      sink.resume()
      await w.writeTo(sink, mergedResult.output, namespaces)
      sink.end()
    })
  })
}
