import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MergeDriver } from '../../src/driver/MergeDriver.js'
import { defaultConfig } from '../utils/testConfig.js'

// End-to-end integration test that drives MergeDriver against real files —
// no mocks on `fs` or `XmlMerger`. This exercises the full pipeline
// (driver → XmlMerger → JsonMerger → MergeOrchestrator → merge nodes →
// serializer) and guards against regressions that mock-heavy unit tests
// would silently miss.

const PROFILE_BASE = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`

const PROFILE_LOCAL = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`

const PROFILE_OTHER = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Description</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`

describe('MergeDriver (integration — real filesystem, no mocks)', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'sf-gmd-int-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  const writeFixture = (name: string, content: string): string => {
    const p = join(workDir, name)
    writeFileSync(p, content, 'utf8')
    return p
  }

  it('Given a non-conflicting three-way merge, When running mergeFiles, Then writes the merged profile to %A and returns hasConflict=false', async () => {
    // Arrange
    const ancestor = writeFixture('base.xml', PROFILE_BASE)
    const local = writeFixture('local.xml', PROFILE_LOCAL)
    const other = writeFixture('other.xml', PROFILE_OTHER)
    const sut = new MergeDriver(defaultConfig)

    // Act
    const hasConflict = await sut.mergeFiles(ancestor, local, other)

    // Assert — local kept its Account.Name editable=false change; other
    // added Account.Description; they don't overlap → clean merge.
    expect(hasConflict).toBe(false)
    const merged = readFileSync(local, 'utf8')
    expect(merged).toContain('Account.Name')
    expect(merged).toContain('Account.Phone')
    expect(merged).toContain('Account.Description')
  })

  it('Given both sides set the same field to different values (true conflict), When running mergeFiles, Then returns hasConflict=true and writes conflict markers into %A', async () => {
    // Arrange — both sides flip Account.Name editable to different values
    // (local sets false, other sets "indeterminate")
    const baseXml = PROFILE_BASE
    const localXml = PROFILE_BASE.replace(
      '<editable>true</editable>',
      '<editable>false</editable>'
    )
    const otherXml = PROFILE_BASE.replace(
      '<editable>true</editable>',
      '<editable>true-but-different</editable>'
    )
    const ancestor = writeFixture('base.xml', baseXml)
    const local = writeFixture('local.xml', localXml)
    const other = writeFixture('other.xml', otherXml)
    const sut = new MergeDriver(defaultConfig)

    // Act
    const hasConflict = await sut.mergeFiles(ancestor, local, other)

    // Assert
    expect(hasConflict).toBe(true)
    const merged = readFileSync(local, 'utf8')
    expect(merged).toContain('<<<<<<<')
    expect(merged).toContain('=======')
    expect(merged).toContain('>>>>>>>')
  })

  it('Given identical three-way input, When running mergeFiles, Then returns hasConflict=false and preserves the file byte-for-byte', async () => {
    // Arrange
    const ancestor = writeFixture('base.xml', PROFILE_BASE)
    const local = writeFixture('local.xml', PROFILE_BASE)
    const other = writeFixture('other.xml', PROFILE_BASE)
    const sut = new MergeDriver(defaultConfig)

    // Act
    const hasConflict = await sut.mergeFiles(ancestor, local, other)

    // Assert — no conflict and local round-trips unchanged except for the
    // trailing newline the writer canonicalises in (to converge with
    // `sf project retrieve`). Still guards against accidental
    // re-serialisation drift like attribute-order changes or whitespace
    // normalisation in the body.
    expect(hasConflict).toBe(false)
    const merged = readFileSync(local, 'utf8')
    expect(merged).toBe(`${PROFILE_BASE}\n`)
  })

  it('Given malformed XML on the local side, When running mergeFiles, Then rejects and leaves local untouched on disk', async () => {
    // Arrange — ancestor/other are valid, local is malformed (missing closing tag)
    const ancestor = writeFixture('base.xml', PROFILE_BASE)
    const badXml = '<?xml version="1.0"?><Profile><broken>'
    const local = writeFixture('local.xml', badXml)
    const other = writeFixture('other.xml', PROFILE_OTHER)
    const sut = new MergeDriver(defaultConfig)

    // Act & Assert — the parse failure propagates so bin/driver.ts can
    // report it on stderr and exit 1; `local` is only ever overwritten by
    // the rename() on the success path, so it stays exactly as written.
    await expect(sut.mergeFiles(ancestor, local, other)).rejects.toThrow()
    const restored = readFileSync(local, 'utf8')
    expect(restored).toBe(badXml)
  })

  it('Given one branch adds a new package.xml <types> with multiple <members>, When running mergeFiles, Then each <members> emits as a distinct sibling element under a single <types> block', async () => {
    // Arrange — brand-new wrapper-array entries containing parser-shape
    // arrays (e.g. members:["MyClass","OtherClass"]) must not have their
    // array values collapsed into a single tag with concatenated text.
    const baseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Account</members>
        <name>CustomObject</name>
    </types>
    <version>59.0</version>
</Package>`
    const localXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Account</members>
        <name>CustomObject</name>
    </types>
    <types>
        <members>MyClass</members>
        <members>OtherClass</members>
        <name>ApexClass</name>
    </types>
    <version>59.0</version>
</Package>`
    const otherXml = baseXml
    const ancestor = writeFixture('package-base.xml', baseXml)
    const local = writeFixture('package-local.xml', localXml)
    const other = writeFixture('package-other.xml', otherXml)
    const sut = new MergeDriver(defaultConfig)

    // Act
    const hasConflict = await sut.mergeFiles(ancestor, local, other)

    // Assert — no conflict, both members preserved as distinct siblings
    // inside a single <types><name>ApexClass</name>...</types> block.
    expect(hasConflict).toBe(false)
    const merged = readFileSync(local, 'utf8')
    expect(merged).toContain('<members>MyClass</members>')
    expect(merged).toContain('<members>OtherClass</members>')
    // Hard guard against the regression: the buggy output put both
    // members into a single tag (`<members>MyClassOtherClass</members>`).
    expect(merged).not.toMatch(/<members>MyClassOtherClass<\/members>/)
    // And both members must live inside the same <types> block (not split
    // across separate <types> elements either).
    const apexTypesBlock = merged.match(
      /<types>[^<]*(?:<members>[^<]+<\/members>[^<]*)+<name>ApexClass<\/name>[^<]*<\/types>/
    )
    expect(apexTypesBlock).not.toBeNull()
    expect(apexTypesBlock![0]).toContain('<members>MyClass</members>')
    expect(apexTypesBlock![0]).toContain('<members>OtherClass</members>')
  })

  it('Given a missing ancestor file, When running mergeFiles, Then rejects with ENOENT (bin classifies as usage error, exit 2)', async () => {
    // Input-not-found is a caller contract violation (git passed us a
    // bad path). The driver rethrows ENOENT so the bin can exit 2; every
    // other failure is rethrown too (exit 1). `local` is never touched on
    // disk — the write path is never reached.
    const ancestor = join(workDir, 'does-not-exist.xml')
    const localBytes = PROFILE_LOCAL
    const local = writeFixture('local.xml', localBytes)
    const other = writeFixture('other.xml', PROFILE_OTHER)
    const sut = new MergeDriver(defaultConfig)

    await expect(sut.mergeFiles(ancestor, local, other)).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(readFileSync(local, 'utf8')).toBe(localBytes)
  })

  describe.each([
    {
      shape: 'each side renames the root element differently',
      ancestor: '<Profile xmlns="A"><custom>false</custom></Profile>',
      ours: '<PermA xmlns="A"><custom>false</custom></PermA>',
      theirs: '<PermB xmlns="A"><custom>false</custom></PermB>',
    },
    {
      shape: 'theirs renames the root element',
      ancestor: '<Profile xmlns="A"><custom>false</custom></Profile>',
      ours: '<Profile xmlns="A"><custom>true</custom></Profile>',
      theirs: '<PermA xmlns="C"/>',
    },
    {
      shape: 'an attribute named __proto__ on the root',
      ancestor: '<Profile xmlns="N" a="1"><custom>false</custom></Profile>',
      ours: '<Profile xmlns="N" __proto__="2" a="1"><custom>false</custom></Profile>',
      theirs: '<Profile xmlns="N" a="1"><custom>false</custom></Profile>',
    },
    {
      shape: 'an attribute named __proto__ below the root',
      ancestor: '<Profile xmlns="N"><b a="1">x</b></Profile>',
      ours: '<Profile xmlns="N"><b __proto__="2" a="1">x</b></Profile>',
      theirs: '<Profile xmlns="N"><b a="1">y</b></Profile>',
    },
    {
      shape: 'a valueless attribute',
      ancestor: '<Profile xmlns="A" flag><custom>false</custom></Profile>',
      ours: '<Profile xmlns="A" flag><custom>false</custom></Profile>',
      theirs: '<Profile xmlns="A" flag><custom>true</custom></Profile>',
    },
  ])('Given $shape', ({ ancestor, ours, theirs }) => {
    it('When running mergeFiles, Then rejects and leaves local byte-identical', async () => {
      // Arrange
      const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
      const localBytes = `${declaration}${ours}`
      const base = writeFixture('base.xml', `${declaration}${ancestor}`)
      const local = writeFixture('local.xml', localBytes)
      const other = writeFixture('other.xml', `${declaration}${theirs}`)
      const sut = new MergeDriver(defaultConfig)

      // Act & Assert
      await expect(sut.mergeFiles(base, local, other)).rejects.toThrow()
      expect(readFileSync(local, 'utf8')).toBe(localBytes)
    })
  })

  describe('Given a side declared ISO-8859-1 with a non-ASCII byte', () => {
    it('When running mergeFiles, Then it rejects and ours stays byte-identical', async () => {
      // Arrange
      const latin1 = Buffer.concat([
        Buffer.from(PROFILE_LOCAL.replace('UTF-8', 'ISO-8859-1')),
        Buffer.from([0x0a]),
      ])
      const oursBytes = Buffer.concat([latin1, Buffer.from([0xe9])])
      const local = join(workDir, 'local.xml')
      writeFileSync(local, oursBytes)
      const ancestor = writeFixture('base.xml', PROFILE_BASE)
      const other = writeFixture('other.xml', PROFILE_OTHER)
      const sut = new MergeDriver(defaultConfig)

      // Act
      const run = sut.mergeFiles(ancestor, local, other)

      // Assert
      await expect(run).rejects.toThrow('declared encoding "ISO-8859-1"')
      expect(readFileSync(local).equals(oursBytes)).toBe(true)
    })
  })

  describe('Given theirs holds bytes that are not valid UTF-8', () => {
    it('When running mergeFiles, Then it rejects and ours stays byte-identical', async () => {
      // Arrange
      const local = writeFixture('local.xml', PROFILE_LOCAL)
      const ancestor = writeFixture('base.xml', PROFILE_BASE)
      const other = join(workDir, 'other.xml')
      writeFileSync(
        other,
        Buffer.concat([Buffer.from(PROFILE_OTHER), Buffer.from([0xff, 0xfe])])
      )
      const sut = new MergeDriver(defaultConfig)

      // Act
      const run = sut.mergeFiles(ancestor, local, other)

      // Assert
      await expect(run).rejects.toThrow('not valid UTF-8')
      expect(readFileSync(local, 'utf8')).toBe(PROFILE_LOCAL)
    })
  })

  describe('Given ours has no content and theirs adds a CRLF file', () => {
    it('When running mergeFiles, Then the output uses CRLF', async () => {
      // Arrange
      const local = writeFixture('local.xml', '')
      const ancestor = writeFixture('base.xml', '')
      const other = writeFixture(
        'other.xml',
        PROFILE_OTHER.replace(/\n/g, '\r\n')
      )
      const sut = new MergeDriver(defaultConfig)

      // Act
      await sut.mergeFiles(ancestor, local, other)

      // Assert
      const merged = readFileSync(local, 'utf8')
      expect(merged).toContain('\r\n')
      expect(merged.replace(/\r\n/g, '')).not.toContain('\n')
    })
  })

  describe('Given both sides hold content with different line endings', () => {
    it('When running mergeFiles, Then ours decides the line endings', async () => {
      // Arrange
      const local = writeFixture('local.xml', PROFILE_LOCAL)
      const ancestor = writeFixture('base.xml', PROFILE_BASE)
      const other = writeFixture(
        'other.xml',
        PROFILE_OTHER.replace(/\n/g, '\r\n')
      )
      const sut = new MergeDriver(defaultConfig)

      // Act
      await sut.mergeFiles(ancestor, local, other)

      // Assert
      expect(readFileSync(local, 'utf8')).not.toContain('\r')
    })
  })
})
