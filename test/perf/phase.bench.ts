import { bench, describe } from 'vitest'
import { FlxXmlParser } from '../../src/adapter/FlxXmlParser.js'
import { FxpXmlSerializer } from '../../src/adapter/FxpXmlSerializer.js'
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

  const parser = new FlxXmlParser()
  const ancestor = parser.parse(fixtures.ancestor)
  const local = parser.parse(fixtures.local)
  const other = parser.parse(fixtures.other)

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

  const serializer = new FxpXmlSerializer(config)
  const _rawXml = serializer.serialize(mergedResult.output, namespaces)

  describe(`phase-parse-${size}`, () => {
    bench(`parse-${size}`, () => {
      const p = new FlxXmlParser()
      p.parse(fixtures.ancestor)
      p.parse(fixtures.local)
      p.parse(fixtures.other)
    })
  })

  describe(`phase-merge-${size}`, () => {
    bench(`merge-${size}`, () => {
      const jm = new JsonMerger(config)
      jm.mergeThreeWay(ancestor.content, local.content, other.content)
    })
  })

  describe(`phase-serialize-${size}`, () => {
    bench(`serialize-${size}`, () => {
      const s = new FxpXmlSerializer(config)
      s.serialize(mergedResult.output, namespaces)
    })
  })
}
