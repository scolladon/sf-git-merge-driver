import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

const COMMENT_COUNT = 100_000
const MAX_MERGE_MS = 1_000
const TEST_TIMEOUT_MS = 60_000

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n'
const comments = '<!--c-->'.repeat(COMMENT_COUNT)
const profile = (description: string): string =>
  `${PROLOG}<Profile xmlns="http://soap.sforce.com/2006/04/metadata"><a>${comments}</a><description>${description}</description></Profile>\n`

describe('a conflicted file with many comments in one element', () => {
  describe('given 100k comments beside a conflicting description', () => {
    it(
      'when merged then it is written in linear time',
      async () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)
        const started = performance.now()

        // Act
        const sut = await mergeXmlStrings(
          merger,
          profile('a'),
          profile('b'),
          profile('c')
        )

        // Assert
        expect(sut.hasConflict).toBe(true)
        expect(performance.now() - started).toBeLessThan(MAX_MERGE_MS)
      },
      TEST_TIMEOUT_MS
    )
  })
})
