import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { bench, describe } from 'vitest'
import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../src/constant/conflictConstant.js'
import { XML_DECL } from '../../src/constant/parserConstant.js'
import { ConflictMarkerFormatter } from '../../src/merger/ConflictMarkerFormatter.js'
import { JsonMerger } from '../../src/merger/JsonMerger.js'
import { builderOptions, parserOptions } from '../../src/merger/XmlMerger.js'
import type { MergeConfig } from '../../src/types/conflictTypes.js'
import { generateProfileFixtures } from './fixtures/generateFixtures.js'

const config: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const fixtures = generateProfileFixtures(size)

  const parser = new XMLParser(parserOptions)
  const ancestorObj = parser.parse(fixtures.ancestor)
  const localObj = parser.parse(fixtures.local)
  const otherObj = parser.parse(fixtures.other)

  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(ancestorObj, localObj, otherObj)

  const builder = new XMLBuilder(builderOptions)
  const mergedXml: string = builder.build(mergedResult.output)
  const rawXml = XML_DECL.concat(mergedXml)

  describe(`phase-parse-${size}`, () => {
    bench(`parse-${size}`, () => {
      const p = new XMLParser(parserOptions)
      p.parse(fixtures.ancestor)
      p.parse(fixtures.local)
      p.parse(fixtures.other)
    })
  })

  describe(`phase-merge-${size}`, () => {
    bench(`merge-${size}`, () => {
      const jm = new JsonMerger(config)
      jm.mergeThreeWay(ancestorObj, localObj, otherObj)
    })
  })

  describe(`phase-build-${size}`, () => {
    bench(`build-${size}`, () => {
      const b = new XMLBuilder(builderOptions)
      b.build(mergedResult.output)
    })
  })

  describe(`phase-format-${size}`, () => {
    bench(`format-${size}`, () => {
      const formatter = new ConflictMarkerFormatter(config)
      formatter.handleSpecialEntities(rawXml)
      formatter.correctConflictIndent(rawXml)
    })
  })
}
