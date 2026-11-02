import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'
const NS = 'xmlns="http://soap.sforce.com/2006/04/metadata"'

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  stream.on('data', (c: Buffer) => chunks.push(c))
  await new Promise<void>(resolve => stream.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

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

const profile = (body: string): string =>
  `${DECL}\n<Profile ${NS}><custom>false</custom>${body}</Profile>\n`

const shownProfile = (body: string): string =>
  `${DECL}\n<Profile ${NS}>\n    <custom>false</custom>\n${body}</Profile>\n`

describe('given a tag whose value is text on one side and an element on another', () => {
  const ELEMENT = '<b><toString>1</toString></b>'
  const SHOWN_ELEMENT = '    <b>\n        <toString>1</toString>\n    </b>\n'

  describe('when only ours replaces the element by text', () => {
    it('then the text is kept, with no property read from a string', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile('<b>x</b>'),
        profile(ELEMENT),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile('    <b>x</b>\n'),
        hasConflict: false,
      })
    })

    it('then the same holds with the sides swapped', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile(ELEMENT),
        profile('<b>x</b>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile('    <b>x</b>\n'),
        hasConflict: false,
      })
    })
  })

  describe('when only ours replaces the element by an empty element', () => {
    it('then the empty element is kept', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile('<b/>'),
        profile(ELEMENT),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile('    <b/>\n'),
        hasConflict: false,
      })
    })
  })

  describe('when both sides replace the element by the same text', () => {
    it('then the text is kept once', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile('<b>x</b>'),
        profile('<b>x</b>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile('    <b>x</b>\n'),
        hasConflict: false,
      })
    })
  })

  describe('when ours replaces the element by text and theirs edits the element', () => {
    it('then the whole value conflicts, each side verbatim', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile('<b>x</b>'),
        profile('<b><toString>2</toString></b>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile(
          `<<<<<<< ours\n    <b>x</b>\n||||||| base\n${SHOWN_ELEMENT}=======\n    <b>\n        <toString>2</toString>\n    </b>\n>>>>>>> theirs\n`
        ),
        hasConflict: true,
      })
    })
  })

  describe('when ours adds an element and theirs adds text at the same tag', () => {
    it('then the two additions conflict as whole values', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(''),
        profile(ELEMENT),
        profile('<b>y</b>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: shownProfile(
          `<<<<<<< ours\n${SHOWN_ELEMENT}||||||| base\n=======\n    <b>y</b>\n>>>>>>> theirs\n`
        ),
        hasConflict: true,
      })
    })
  })

  describe('when ours replaces the element by text and theirs deletes it', () => {
    it('then the edit and the deletion conflict', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        profile(ELEMENT),
        profile('<b>x</b>'),
        profile(''),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toContain('<b>x</b>')
    })
  })
})

describe('given a Layout column that one side empties', () => {
  const layout = (column: string): string =>
    `${DECL}\n<Layout ${NS}><layoutSections><label>Info</label>${column}</layoutSections></Layout>\n`
  const FULL =
    '<layoutColumns><layoutItems><field>Name</field></layoutItems></layoutColumns>'
  const EDITED =
    '<layoutColumns><layoutItems><field>Name</field><behavior>Edit</behavior></layoutItems></layoutColumns>'

  describe('when the other side leaves it unchanged', () => {
    it('then the empty column is kept', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        layout(FULL),
        layout('<layoutColumns/>'),
        layout(FULL),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Layout ${NS}>\n    <layoutSections>\n        <label>Info</label>\n        <layoutColumns/>\n    </layoutSections>\n</Layout>\n`,
        hasConflict: false,
      })
    })
  })

  describe('when the other side edits an item of it', () => {
    it('then the conflict shows ours as the empty column, not as an empty side', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        layout(FULL),
        layout('<layoutColumns/>'),
        layout(EDITED),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toContain(
        '<<<<<<< ours\n        <layoutColumns/>\n||||||| base\n'
      )
    })
  })
})

describe('given the root element whose body changes between text and elements', () => {
  const root = (body: string): string =>
    `${DECL}\n<Profile ${NS}>${body}</Profile>\n`
  const ELEMENTS = '<custom>true</custom>'

  describe('when only ours replaces the elements by text', () => {
    it('then the text is kept as ours wrote it', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        root(ELEMENTS),
        root('hello'),
        root(ELEMENTS),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Profile ${NS}>hello</Profile>\n`,
        hasConflict: false,
      })
    })
  })

  describe('when ours replaces the elements by text and theirs edits an element', () => {
    it('then the root conflicts as one value, each side as it is', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        root(ELEMENTS),
        root('hello'),
        root('<custom>false</custom>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toContain(`<<<<<<< ours\n<Profile ${NS}>hello`)
      expect(sut.output).toContain('<custom>true</custom>')
      expect(sut.output).toContain('<custom>false</custom>')
    })
  })

  describe('when ours empties the root and theirs edits an element', () => {
    it('then the entries still merge one by one', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        root('<custom>true</custom><description>d</description>'),
        `${DECL}\n<Profile ${NS}/>\n`,
        root('<custom>true</custom><description>e</description>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).not.toContain('<custom>')
    })
  })
})

describe('given a tag whose value is CDATA on one side and an element on another', () => {
  const doc = (body: string): string =>
    `${DECL}\n<Profile ${NS}><a>${body}</a></Profile>\n`

  describe('when ours replaces the CDATA by an element and theirs edits the CDATA', () => {
    it('then the tag conflicts as one value', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        doc('<![CDATA[x]]>'),
        doc('<b>1</b>'),
        doc('<![CDATA[y]]>'),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toMatch(
        /<<<<<<< ours\n\s*<a>\n\s*<b>1<\/b>\n\s*<\/a>\n\|\|\|\|\|\|\| base\n[\s\S]*<!\[CDATA\[x\]\]>[\s\S]*=======\n[\s\S]*<!\[CDATA\[y\]\]>[\s\S]*>>>>>>> theirs/
      )
    })
  })
})

describe('given a repeated element whose entries are text on another side', () => {
  const entry = (field: string, editable: string): string =>
    `<fieldPermissions><field>${field}</field><editable>${editable}</editable></fieldPermissions>`
  const shown = (field: string, editable: string): string =>
    `    <fieldPermissions>\n        <field>${field}</field>\n        <editable>${editable}</editable>\n    </fieldPermissions>\n`
  const only = (body: string): string =>
    `${DECL}\n<Profile ${NS}>${body}</Profile>\n`

  describe('when ours repeats the element and theirs edits its first entry', () => {
    it('then no entry of ours is fused into another', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        only('<fieldPermissions>text</fieldPermissions>'),
        only(entry('A.b', 'true') + entry('A.c', 'true')),
        only(entry('A.b', 'false')),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Profile ${NS}>\n    <fieldPermissions>\n        <field>A.b</field>\n<<<<<<< ours\n        <editable>true</editable>\n||||||| base\n=======\n        <editable>false</editable>\n>>>>>>> theirs\n    </fieldPermissions>\n${shown('A.c', 'true')}</Profile>\n`,
        hasConflict: true,
      })
    })
  })

  describe('when ours turns the element into text and theirs adds an entry', () => {
    it('then the text and the entries are all kept', async () => {
      // Arrange
      const [ancestor, ours, theirs] = [
        only(entry('A.b', 'true')),
        only('<fieldPermissions>text</fieldPermissions>'),
        only(entry('A.b', 'true') + entry('A.c', 'true')),
      ]

      // Act
      const sut = await merged(ancestor, ours, theirs)

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Profile ${NS}>\n    <fieldPermissions>text</fieldPermissions>\n${shown('A.c', 'true')}</Profile>\n`,
        hasConflict: false,
      })
    })
  })
})

describe('given a tag whose value is a CDATA section or a comment alone', () => {
  const description = (body: string): string =>
    `${DECL}\n<Profile ${NS}><description>${body}</description></Profile>\n`

  describe.each([
    [
      'CDATA is replaced by text on ours',
      '<![CDATA[x]]>',
      'y',
      '<![CDATA[x]]>',
      'y',
    ],
    [
      'a comment is replaced by text on theirs',
      '<!--n-->',
      '<!--n-->',
      'b',
      'b',
    ],
    [
      'text is replaced by a comment on ours',
      'a',
      '<!--note-->',
      'a',
      '<!--note-->',
    ],
  ])('when %s', (_, base, ours, theirs, kept) => {
    it('then the changed value is kept, not dropped', async () => {
      // Act
      const sut = await merged(
        description(base),
        description(ours),
        description(theirs)
      )

      // Assert
      expect(sut.hasConflict).toBe(false)
      expect(sut.output).toContain(kept)
    })
  })

  describe('when ours turns the comment into text and theirs turns it into CDATA', () => {
    it('then the two values conflict', async () => {
      // Act
      const sut = await merged(
        description('<!--n-->'),
        description('b'),
        description('<![CDATA[c]]>')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })

  describe('when both sides empty a CDATA section', () => {
    it('then the empty element is kept', async () => {
      // Act
      const sut = await merged(
        description('<![CDATA[x]]>'),
        `${DECL}\n<Profile ${NS}><description/></Profile>\n`,
        `${DECL}\n<Profile ${NS}><description/></Profile>\n`
      )

      // Assert
      expect(sut).toEqual({
        output: `${DECL}\n<Profile ${NS}>\n    <description/>\n</Profile>\n`,
        hasConflict: false,
      })
    })
  })
})

describe('given the root element whose body is text on a side', () => {
  const root = (body: string): string =>
    `${DECL}\n<Profile ${NS}>${body}</Profile>\n`

  describe.each([
    ['hello', 'world', 'hello', 'world'],
    ['a', 'b', 'a', 'b'],
  ])(
    'when the text %s is changed to %s by one side only',
    (base, ours, theirs, kept) => {
      it('then the change is kept', async () => {
        // Act
        const sut = await merged(root(base), root(ours), root(theirs))

        // Assert
        expect(sut).toEqual({ output: root(kept), hasConflict: false })
      })
    }
  )

  describe('when both sides change the text apart', () => {
    it('then the two texts conflict', async () => {
      // Act
      const sut = await merged(root('a'), root('b'), root('c'))

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toContain('>b<')
      expect(sut.output).toContain('>c<')
    })
  })

  describe('when ours empties the root and theirs replaces the elements by text', () => {
    it('then ours shows as the empty root, not as nothing', async () => {
      // Act
      const sut = await merged(
        root('<custom>true</custom>'),
        `${DECL}\n<Profile ${NS}/>\n`,
        root('hello')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
      expect(sut.output).toContain(`<<<<<<< ours\n<Profile ${NS}/>`)
    })
  })
})

describe('given a label value that ends in a no-break space', () => {
  describe('when theirs edits a sibling tag', () => {
    it('then the no-break space survives the merge', async () => {
      // Arrange
      const label = '<description>Price: </description>'

      // Act
      const sut = await merged(
        profile(label),
        profile(label),
        profile(`${label}<userLicense>S</userLicense>`)
      )

      // Assert
      expect(sut.hasConflict).toBe(false)
      expect(sut.output).toContain('<description>Price: </description>')
    })
  })
})

describe('given a value made of adjacent sections', () => {
  const SPLIT_ESCAPE = '<![CDATA[x]]]]><![CDATA[>y]]>'
  const TWO_CDATA = '<![CDATA[A]]><![CDATA[B]]>'
  const TWO_COMMENTS = '<!--c1--><!--c2-->'
  const tag = (inner: string): string =>
    profile(`<description>${inner}</description>`)

  describe.each([
    ['the standard CDATA escape', SPLIT_ESCAPE],
    ['two CDATA sections', TWO_CDATA],
    ['two comments', TWO_COMMENTS],
  ])('given %s', (_, value) => {
    describe('when no side changes it', () => {
      it('then it is written back byte for byte', async () => {
        // Act
        const sut = await merged(tag(value), tag(value), tag(value))

        // Assert
        expect(sut.hasConflict).toBe(false)
        expect(sut.output).toContain(`<description>${value}`)
      })
    })
  })

  describe('when one side edits the second part of the CDATA escape', () => {
    it('then the parts stay adjacent, in order', async () => {
      // Act
      const sut = await merged(
        tag(SPLIT_ESCAPE),
        tag(SPLIT_ESCAPE),
        tag('<![CDATA[x]]]]><![CDATA[>z]]>')
      )

      // Assert
      expect(sut.hasConflict).toBe(false)
      expect(sut.output).toContain('<description><![CDATA[x]]]]><![CDATA[>z]]>')
    })
  })

  describe.each([
    [
      'CDATA sections',
      TWO_CDATA,
      '<![CDATA[A2]]><![CDATA[B]]>',
      '<![CDATA[A]]><![CDATA[B2]]>',
    ],
    ['comments', TWO_COMMENTS, '<!--c9--><!--c2-->', '<!--c1--><!--c8-->'],
  ])('given two %s', (_, ancestor, ours, theirs) => {
    describe('when each side edits another part', () => {
      it('then it is one conflict, not a value no side held', async () => {
        // Act
        const sut = await merged(tag(ancestor), tag(ours), tag(theirs))

        // Assert
        expect(sut.hasConflict).toBe(true)
      })
    })
  })

  describe('when the root body is made of two comments and each side edits one', () => {
    it('then it is one conflict', async () => {
      // Arrange
      const body = (inner: string): string =>
        `${DECL}\n<Profile ${NS}>${inner}</Profile>\n`

      // Act
      const sut = await merged(
        body(TWO_COMMENTS),
        body('<!--c9--><!--c2-->'),
        body('<!--c1--><!--c8-->')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })
})

describe('given a keyed entry, among others, holding text beside its child tags', () => {
  const entry = (text: string, editable: string): string =>
    profile(
      `<fieldPermissions><editable>${editable}</editable><field>A.x</field>${text}</fieldPermissions><fieldPermissions><field>A.y</field></fieldPermissions>`
    )

  describe('when each side edits another part of it', () => {
    it('then it is one conflict, not an entry no side held', async () => {
      // Act
      const sut = await merged(
        entry('a', 'true'),
        entry('b', 'true'),
        entry('a', 'false')
      )

      // Assert
      expect(sut.hasConflict).toBe(true)
    })
  })

  describe('when one side edits its text', () => {
    it('then the edit is kept without conflict', async () => {
      // Act
      const sut = await merged(
        entry('a', 'true'),
        entry('b', 'true'),
        entry('a', 'true')
      )

      // Assert
      expect(sut.hasConflict).toBe(false)
      expect(sut.output).toContain('b')
    })
  })
})
