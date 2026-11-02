import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../../utils/mergeXmlStrings.js'
import { defaultConfig } from '../../utils/testConfig.js'

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'
const NS = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
const XSI = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
const DELETED = ''

const profile = (body: string, attributes = ''): string =>
  body === ''
    ? `${DECL}\n<Profile ${NS}${attributes}/>\n`
    : `${DECL}\n<Profile ${NS}${attributes}>${body}</Profile>\n`

const merge = (ancestor: string, ours: string, theirs: string) =>
  mergeXmlStrings(new XmlMerger(defaultConfig), ancestor, ours, theirs)

describe('given one side deleted a file the other side changed', () => {
  describe.each([
    [
      'the ancestor root is empty and the other side fills it',
      profile(''),
      profile('<custom>false</custom>'),
    ],
    [
      'only the root attributes changed',
      profile('<custom>true</custom>'),
      profile('<custom>true</custom>', ` ${XSI}`),
    ],
    [
      'the body is the same and an attribute is added',
      profile('<custom>true</custom><userLicense>S</userLicense>'),
      profile('<custom>true</custom><userLicense>S</userLicense>', ` ${XSI}`),
    ],
    [
      'the other side emptied the root',
      profile('<custom>true</custom>'),
      profile(''),
    ],
    [
      'the other side edited the body',
      profile('<custom>true</custom>'),
      profile('<custom>false</custom>'),
    ],
    ['the other side added a root text body', profile(''), profile('text')],
    [
      'the other side added a root CDATA body',
      profile(''),
      profile('<![CDATA[x]]>'),
    ],
    [
      'the other side added a root comment body',
      profile(''),
      profile('<!--c-->'),
    ],
  ])('given %s', (_, ancestor, changed) => {
    describe('when ours deleted the file', () => {
      it('then the whole file is one conflict', async () => {
        // Act
        const sut = await merge(ancestor, DELETED, changed)

        // Assert
        expect(sut.hasConflict).toBe(true)
        expect(sut.output).toMatch(/^<{7} ours\n/m)
      })
    })

    describe('when theirs deleted the file', () => {
      it('then the whole file is one conflict', async () => {
        // Act
        const sut = await merge(ancestor, changed, DELETED)

        // Assert
        expect(sut.hasConflict).toBe(true)
        expect(sut.output).toMatch(/^>{7} theirs$/m)
      })
    })
  })

  describe('when ours deleted the file and theirs changed its root attributes', () => {
    it('then each side shows its own root', async () => {
      // Arrange
      const ancestor = profile('<custom>true</custom>')

      // Act
      const sut = await merge(
        ancestor,
        DELETED,
        profile('<custom>true</custom>', ` ${XSI}`)
      )

      // Assert
      expect(sut.output).toBe(
        [
          DECL,
          '<<<<<<< ours',
          '||||||| base',
          `<Profile ${NS}>`,
          '    <custom>true</custom>',
          '</Profile>',
          '=======',
          `<Profile ${NS} ${XSI}>`,
          '    <custom>true</custom>',
          '</Profile>',
          '>>>>>>> theirs',
          '',
        ].join('\n')
      )
    })
  })
})

describe('given one side deleted a file the other side left alone', () => {
  const ancestor = profile('<custom>true</custom>')

  describe.each([
    ['ours', DELETED, ancestor],
    ['theirs', ancestor, DELETED],
  ])('when %s deleted it', (_, ours, theirs) => {
    it('then the file stays deleted', async () => {
      // Act
      const sut = await merge(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({ output: '', hasConflict: false })
    })
  })
})

describe('given one side deleted a file the other side only reordered attributes of', () => {
  const OTHER_ATTR = 'a="1" b="2"'
  const SWAPPED_ATTR = 'b="2" a="1"'
  const nested = (attributes: string): string =>
    `<custom ${attributes}><x>1</x></custom><sibling>s</sibling>`

  describe.each([
    [
      'the root',
      profile('<custom>true</custom>', ` ${OTHER_ATTR}`),
      profile('<custom>true</custom>', ` ${SWAPPED_ATTR}`),
    ],
    [
      'a nested tag',
      profile(nested(OTHER_ATTR)),
      profile(nested(SWAPPED_ATTR)),
    ],
  ])('given %s', (_, ancestor, reordered) => {
    describe.each([
      ['ours', DELETED, reordered],
      ['theirs', reordered, DELETED],
    ])('when %s deleted the file', (__, ours, theirs) => {
      it('then the file stays deleted', async () => {
        // Act
        const sut = await merge(ancestor, ours, theirs)

        // Assert
        expect(sut).toEqual({ output: '', hasConflict: false })
      })
    })
  })

  describe('when a nested attribute value also changed', () => {
    it('then the whole file is one conflict', async () => {
      // Act
      const sut = await merge(
        profile(nested(OTHER_ATTR)),
        DELETED,
        profile(nested('b="3" a="1"'))
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })

  describe('when the child tags were reordered too', () => {
    it('then the whole file is one conflict', async () => {
      // Act
      const sut = await merge(
        profile('<a>1</a><b>2</b>'),
        DELETED,
        profile('<b>2</b><a>1</a>')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })
})

describe('given both sides deleted a file', () => {
  describe('when merging', () => {
    it('then the file stays deleted', async () => {
      // Act
      const sut = await merge(
        profile('<custom>true</custom>'),
        DELETED,
        DELETED
      )

      // Assert
      expect(sut).toEqual({ output: '', hasConflict: false })
    })
  })
})

describe('given a file only one side has', () => {
  describe('when the other side and the ancestor have none', () => {
    it('then the file is added without conflict', async () => {
      // Arrange
      const added = profile('<custom>true</custom>')

      // Act
      const sut = await merge(DELETED, DELETED, added)

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Profile ${NS}>\n    <custom>true</custom>\n</Profile>\n`,
        hasConflict: false,
      })
    })
  })
})
