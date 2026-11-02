import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  stream.on('data', (c: Buffer) => chunks.push(c))
  await new Promise<void>(resolve => stream.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

const profile = (attributes: string, body = '    <base>v</base>\n'): string =>
  `${DECL}\n<Profile ${attributes}>\n${body}</Profile>\n`

const merged = async (
  ancestor: string,
  ours: string,
  theirs: string
): Promise<{ output: string; hasConflict: boolean }> => {
  const sink = new PassThrough()
  const collector = collect(sink)
  const { hasConflict } = await new XmlMerger(defaultConfig).mergeThreeWay(
    Readable.from([ancestor]),
    Readable.from([ours]),
    Readable.from([theirs]),
    sink
  )
  sink.end()
  return { output: await collector, hasConflict }
}

const startTagConflict = (
  ours: string,
  base: string,
  theirs: string,
  body = '    <base>v</base>\n'
): string =>
  `${DECL}\n<<<<<<< ours\n<Profile ${ours}>\n||||||| base\n<Profile ${base}>\n=======\n<Profile ${theirs}>\n>>>>>>> theirs\n${body}</Profile>\n`

describe('given the root attributes of the three sides', () => {
  describe('when both sides add the same attribute with different values', () => {
    it('then the start tag conflicts, each side verbatim', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u"'),
        profile('xmlns="u" a="1"'),
        profile('xmlns="u" a="2"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: startTagConflict(
          'xmlns="u" a="1"',
          'xmlns="u"',
          'xmlns="u" a="2"'
        ),
        hasConflict: true,
      })
    })

    it('then swapping the sides swaps the start tags', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u"'),
        profile('xmlns="u" a="2"'),
        profile('xmlns="u" a="1"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        startTagConflict('xmlns="u" a="2"', 'xmlns="u"', 'xmlns="u" a="1"')
      )
    })
  })

  describe('when one side deletes an attribute the other edits', () => {
    it('then the start tag conflicts', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u" a="0"'),
        profile('xmlns="u"'),
        profile('xmlns="u" a="2"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        startTagConflict('xmlns="u"', 'xmlns="u" a="0"', 'xmlns="u" a="2"')
      )
    })
  })

  describe('when each side changes a different attribute', () => {
    it('then both changes merge with no conflict', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u" a="0" b="0"'),
        profile('xmlns="u" a="1" b="0"'),
        profile('xmlns="u" a="0" b="2"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: profile('xmlns="u" a="1" b="2"'),
        hasConflict: false,
      })
    })
  })

  describe('when both sides make the same change', () => {
    it('then the change is kept with no conflict', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u"'),
        profile('xmlns="u" a="1"'),
        profile('xmlns="u" a="1"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: profile('xmlns="u" a="1"'),
        hasConflict: false,
      })
    })
  })

  describe('when two attributes diverge and a third is edited by one side', () => {
    it('then every side keeps the clean edit next to its own divergent values', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="u" a="0" c="0"'),
        profile('xmlns="u" a="1" c="0"'),
        profile('xmlns="u" a="2" c="3"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        startTagConflict(
          'xmlns="u" a="1" c="3"',
          'xmlns="u" a="0" c="0"',
          'xmlns="u" a="2" c="3"'
        )
      )
    })
  })

  describe('when the divergent root also holds a content conflict', () => {
    it('then both conflicts are reported', async () => {
      // Arrange
      const body = (value: string): string => `    <base>${value}</base>\n`
      const [ancestor, ours, theirs] = [
        profile('xmlns="u"', body('v')),
        profile('xmlns="u" a="1"', body('o')),
        profile('xmlns="u" a="2"', body('t')),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toContain('<Profile xmlns="u" a="1">\n||||||| base')
      expect(sut.output).toContain('<base>o</base>')
      expect(sut.hasConflict).toBe(true)
    })
  })

  describe('when the divergent root is empty', () => {
    it('then each side is a well-formed empty root', async () => {
      // Arrange
      const empty = (attributes: string): string =>
        `${DECL}\n<Profile ${attributes}/>\n`
      const [ancestor, ours, theirs] = [
        empty('xmlns="u"'),
        empty('xmlns="u" a="1"'),
        empty('xmlns="u" a="2"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        `${DECL}\n<<<<<<< ours\n<Profile xmlns="u" a="1"/>\n||||||| base\n<Profile xmlns="u"/>\n=======\n<Profile xmlns="u" a="2"/>\n>>>>>>> theirs\n`
      )
    })
  })
})

describe('given a conflict that occupies the whole document', () => {
  const root = (name: string, attributes: string, custom: string): string =>
    `${DECL}\n<${name} ${attributes}><custom>${custom}</custom></${name}>`
  const shown = (name: string, attributes: string, custom: string): string =>
    `<${name} ${attributes}>\n    <custom>${custom}</custom>\n</${name}>\n`

  describe('when theirs deletes the file that ours re-declared', () => {
    it('then every side renders with its own root attributes', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        root('Profile', 'xmlns="A"', 'false'),
        root('Profile', 'xmlns="B"', 'true'),
        `${DECL}\n`,
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        `${DECL}\n<<<<<<< ours\n${shown('Profile', 'xmlns="B"', 'true')}||||||| base\n${shown('Profile', 'xmlns="A"', 'false')}=======\n>>>>>>> theirs\n`
      )
    })
  })

  describe('when ours deletes the file and theirs edits it with a new attribute', () => {
    it('then base and theirs each render their own root attributes', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        root('Profile', 'xmlns="a"', 'false'),
        `${DECL}\n`,
        root('Profile', 'xmlns="a" valueOf="2"', 'true'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        `${DECL}\n<<<<<<< ours\n||||||| base\n${shown('Profile', 'xmlns="a"', 'false')}=======\n${shown('Profile', 'xmlns="a" valueOf="2"', 'true')}>>>>>>> theirs\n`
      )
    })
  })
})

describe('given contested root attribute values holding a line break', () => {
  describe('when a value carries a line that reads as a marker', () => {
    it('then the line break is written as a character reference', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile('xmlns="A" a="1"'),
        profile('xmlns="A" a="2"'),
        profile('xmlns="A" a="x\n>>>>>>> theirs\ny"'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toBe(
        startTagConflict(
          'xmlns="A" a="2"',
          'xmlns="A" a="1"',
          'xmlns="A" a="x&#10;>>>>>>> theirs&#10;y"'
        )
      )
    })
  })

  describe('when every side agrees on a value carrying a line that reads as a marker and the body conflicts', () => {
    it('then that line is escaped in the start tag', async () => {
      // Arrange
      const attributes = 'xmlns="A" a="x\n>>>>>>> theirs\ny"'
      const body = (value: string): string => `    <base>${value}</base>\n`
      const [ancestor, ours, theirs] = [
        profile(attributes, body('v')),
        profile(attributes, body('o')),
        profile(attributes, body('t')),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.output).toContain(
        '<Profile xmlns="A" a="x\n&#62;>>>>>> theirs\ny">'
      )
    })
  })
})

describe('given the documents do not share one root element tag', () => {
  const root = (name: string): string =>
    `${DECL}\n<${name} xmlns="A"><custom>false</custom></${name}>`

  describe.each([
    ['each side renames it differently', 'Profile', 'PermA', 'PermB'],
    ['ours renames it', 'Profile', 'PermA', 'Profile'],
    ['theirs renames it', 'Profile', 'Profile', 'PermA'],
    ['both sides rename it alike', 'Profile', 'PermA', 'PermA'],
  ])('when %s', (_, ancestor, ours, theirs) => {
    it('then the merge is refused', async () => {
      // Act
      const sut = merged(root(ancestor), root(ours), root(theirs))

      // Assert
      await expect(sut).rejects.toThrow(
        'XML merge error: the documents do not share one root element'
      )
    })
  })

  describe('when both sides add the file under different root tags', () => {
    it('then the merge is refused', async () => {
      // Act
      const sut = merged('', root('PermA'), root('PermB'))

      // Assert
      await expect(sut).rejects.toThrow(
        'XML merge error: the documents do not share one root element'
      )
    })
  })

  describe.each([
    ['ours deleted the file and theirs renames', '', root('PermA')],
    ['ours renames and theirs deleted the file', root('PermA'), ''],
  ])('when %s', (_, ours, theirs) => {
    it('then the merge is refused', async () => {
      // Act
      const sut = merged(root('Profile'), ours, theirs)

      // Assert
      await expect(sut).rejects.toThrow(
        'XML merge error: the documents do not share one root element'
      )
    })
  })

  describe('when a side deleted the file', () => {
    it('then the rootless side does not count as a rename', async () => {
      // Act
      const sut = merged(root('Profile'), '', root('Profile'))

      // Assert
      await expect(sut).resolves.toBeDefined()
    })
  })
})
