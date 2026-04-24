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

    // Assert — no conflict and local is byte-identical to the input
    // (idempotent no-op merge; guards against accidental re-serialisation
    // drift like attribute-order changes or whitespace normalisation).
    expect(hasConflict).toBe(false)
    const merged = readFileSync(local, 'utf8')
    expect(merged).toBe(PROFILE_BASE)
  })

  it('Given malformed XML on the local side, When running mergeFiles, Then restores original ourContent and returns hasConflict=true', async () => {
    // Arrange — ancestor/other are valid, local is malformed (missing closing tag)
    const ancestor = writeFixture('base.xml', PROFILE_BASE)
    const badXml = '<?xml version="1.0"?><Profile><broken>'
    const local = writeFixture('local.xml', badXml)
    const other = writeFixture('other.xml', PROFILE_OTHER)
    const sut = new MergeDriver(defaultConfig)

    // Act
    const hasConflict = await sut.mergeFiles(ancestor, local, other)

    // Assert — merge failure is surfaced as a conflict, and local is restored
    expect(hasConflict).toBe(true)
    const restored = readFileSync(local, 'utf8')
    expect(restored).toBe(badXml)
  })

  it('Given a missing ancestor file, When running mergeFiles, Then rejects with ENOENT (bin classifies as usage error, exit 2)', async () => {
    // Input-not-found is a caller contract violation (git passed us a
    // bad path). The driver rethrows ENOENT so the bin can exit 2;
    // other failures are swallowed and return hasConflict=true. `local`
    // is never touched on disk — the write path is never reached.
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
})
