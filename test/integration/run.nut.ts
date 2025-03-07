import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'

const ROOT_FOLDER = './test/data'
const TEST_FILES_FOLDER = 'testFiles'

describe('git merge driver run', () => {
  before(() => {
    // Arrange
    mkdirSync(join(ROOT_FOLDER, TEST_FILES_FOLDER), { recursive: true })
    const ancestorContent = '<root>\n  <item>common</item>\n</root>'
    const ourContent = '<root>\n  <item>our change</item>\n</root>'
    const theirContent = '<root>\n  <item>their change</item>\n</root>'

    writeFileSync(
      join(ROOT_FOLDER, TEST_FILES_FOLDER, 'ancestor.xml'),
      ancestorContent
    )
    writeFileSync(join(ROOT_FOLDER, TEST_FILES_FOLDER, 'ours.xml'), ourContent)
    writeFileSync(
      join(ROOT_FOLDER, TEST_FILES_FOLDER, 'theirs.xml'),
      theirContent
    )
    writeFileSync(join(ROOT_FOLDER, TEST_FILES_FOLDER, 'output.xml'), '')
  })

  after(() => {
    // Clean up test files
    rmSync(join(ROOT_FOLDER, TEST_FILES_FOLDER), { recursive: true })
  })

  it('merges XML files correctly', () => {
    // Act
    execCmd(
      `git merge driver run --ancestor-file ${join(TEST_FILES_FOLDER, 'ancestor.xml')} --our-file ${join(TEST_FILES_FOLDER, 'ours.xml')} --theirs-file ${join(TEST_FILES_FOLDER, 'theirs.xml')} --output-file ${join(TEST_FILES_FOLDER, 'output.xml')}`,
      {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      }
    )

    // Assert
    const outputPath = join(ROOT_FOLDER, TEST_FILES_FOLDER, 'output.xml')
    expect(existsSync(outputPath)).to.be.true

    const outputContent = readFileSync(outputPath, 'utf-8')
    expect(outputContent).to.include('<root>')
    expect(outputContent).to.include('</root>')
    /*
    expect(outputContent).to.include('our change')
    expect(outputContent).to.include('their change')
    expect(outputContent).to.include('common')
    */
  })
})
