import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser as LiveParser } from '../../src/adapter/parser/CompactXmlParser.js'
import type { JsonValue } from '../../src/types/jsonTypes.js'
import {
  buildParitySnapshot,
  listParityInputs,
  type ParitySnapshot,
  parseOutcome,
} from '../utils/parserParity.js'

const OUTCOMES_SNAPSHOT_PATH = 'test/fixtures/parser-parity/outcomes.json'

const readSnapshot = (): ParitySnapshot =>
  JSON.parse(readFileSync(OUTCOMES_SNAPSHOT_PATH, 'utf8'))

const assertNullPrototypeTree = (node: JsonValue): void => {
  if (Array.isArray(node)) {
    for (const item of node) assertNullPrototypeTree(item)
    return
  }
  if (node === null || typeof node !== 'object') return

  expect(Object.getPrototypeOf(node)).toBeNull()
  for (const value of Object.values(node)) assertNullPrototypeTree(value)
}

describe('parser parity — CompactXmlParser vs the pinned snapshot', () => {
  const sut = new LiveParser()
  const snapshot = readSnapshot()
  const live = buildParitySnapshot(sut)

  describe('given every fixture file under test/fixtures', () => {
    it('when parsing each one then outcomes match the pinned snapshot', () => {
      expect(live.files).toEqual(snapshot.files)
    })
  })

  describe('given every labelled edge-case input', () => {
    it('when parsing each one then outcomes match the pinned snapshot', () => {
      expect(live.edges).toEqual(snapshot.edges)
    })
  })

  describe('given the generated medium, large and xl tiers', () => {
    it('when hashing each tier outcome then hashes match the pinned snapshot', () => {
      expect(live.tiers).toEqual(snapshot.tiers)
    })
  })

  describe('given every fixture file that parses without throwing', () => {
    it('when walking content[rootKey] then every non-array object node is null-prototype', () => {
      const { files } = listParityInputs()

      for (const [, xml] of files) {
        if (parseOutcome(sut, xml).startsWith('throw:')) continue

        const { content } = sut.parseString(xml)
        const rootKey = Object.keys(content)[0]
        if (rootKey === undefined) continue

        assertNullPrototypeTree(content[rootKey] as JsonValue)
      }
    })
  })
})
