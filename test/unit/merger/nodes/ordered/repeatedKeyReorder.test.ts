import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../../../../utils/mergeXmlStrings.js'
import { defaultConfig } from '../../../../utils/testConfig.js'

const NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

const entry = (key: string, tags: readonly string[]): string =>
  `    <customValue>\n${tags
    .map(tag => `        <${tag}>${tag === 'fullName' ? key : 'v'}</${tag}>\n`)
    .join('')}    </customValue>\n`

const file = (entries: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<GlobalValueSet xmlns="${NAMESPACE}">\n${entries.join('')}    <masterLabel>M</masterLabel>\n</GlobalValueSet>\n`

const X = entry('x', ['fullName', 'default', 'label'])
const Xr = entry('x', ['label', 'default', 'fullName'])
const Y = entry('y', ['fullName', 'default', 'label'])

describe('given an ordered key repeated on the ancestor', () => {
  describe('when the readings differ only by the child-tag order of one copy', () => {
    it('then the merge conflicts instead of keeping the first reading', async () => {
      // Arrange
      const ancestor = file([X, X])
      const ours = file([X, Xr, Y, X])
      const theirs = file([X])

      // Act
      const sut = await mergeXmlStrings(
        new XmlMerger(defaultConfig),
        ancestor,
        ours,
        theirs
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })

  describe('when each side keeps one copy and the copies differ by child-tag order', () => {
    it('then the merge conflicts instead of keeping the first reading', async () => {
      // Arrange
      const ancestor = file([X, Xr])
      const ours = file([Xr])
      const theirs = file([X])

      // Act
      const sut = await mergeXmlStrings(
        new XmlMerger(defaultConfig),
        ancestor,
        ours,
        theirs
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })
})
