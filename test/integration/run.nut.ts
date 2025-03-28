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
const CONFLICT_TEST_FILES_FOLDER = 'conflictTestFiles'
const EMPTY_TEST_FILES_FOLDER = 'emptyTestFiles'
const TEST_FOLDERS = [
  TEST_FILES_FOLDER,
  CONFLICT_TEST_FILES_FOLDER,
  EMPTY_TEST_FILES_FOLDER,
]

const setupTestFiles = (
  folder: string,
  ancestorXml: string,
  oursXml: string,
  theirsXml: string
): void => {
  writeFileSync(join(ROOT_FOLDER, folder, 'ancestor.xml'), ancestorXml)
  writeFileSync(join(ROOT_FOLDER, folder, 'ours.xml'), oursXml)
  writeFileSync(join(ROOT_FOLDER, folder, 'theirs.xml'), theirsXml)
}

describe('git merge driver run', () => {
  before(() => {
    // Arrange
    // Create test directories
    TEST_FOLDERS.map(folder =>
      mkdirSync(join(ROOT_FOLDER, folder), { recursive: true })
    )

    // Setup test files
    setupTestFiles(
      TEST_FILES_FOLDER,
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>false</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>false</readable><editable>true</editable></fieldPermissions></Profile>'
    )
    setupTestFiles(
      CONFLICT_TEST_FILES_FOLDER,
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>false</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>false</readable><editable>trueAndFalse</editable></fieldPermissions></Profile>'
    )

    setupTestFiles(
      EMPTY_TEST_FILES_FOLDER,
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
      '',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>'
    )
  })

  after(() => {
    // Clean up test files
    TEST_FOLDERS.map(folder =>
      rmSync(join(ROOT_FOLDER, folder), { recursive: true })
    )
  })

  it('merges XML files without conflict', () => {
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
    expect(outputContent).to.include('<Profile>')
    expect(outputContent).to.include('</Profile>')
    expect(outputContent).to.include('Account.Name')
  })

  it('merges XML files with conflict', () => {
    // Act
    execCmd(
      `git merge driver run --ancestor-file ${join(CONFLICT_TEST_FILES_FOLDER, 'ancestor.xml')} --our-file ${join(CONFLICT_TEST_FILES_FOLDER, 'ours.xml')} --theirs-file ${join(CONFLICT_TEST_FILES_FOLDER, 'theirs.xml')} --output-file ${join(CONFLICT_TEST_FILES_FOLDER, 'output.xml')}`,
      {
        ensureExitCode: 1,
        cwd: ROOT_FOLDER,
      }
    )

    // Assert
    const outputPath = join(
      ROOT_FOLDER,
      CONFLICT_TEST_FILES_FOLDER,
      'output.xml'
    )
    expect(existsSync(outputPath)).to.be.true

    const outputContent = readFileSync(outputPath, 'utf-8')
    expect(outputContent).to.include('<Profile>')
    expect(outputContent).to.include('</Profile>')
    expect(outputContent).to.include('Account.Name')
  })

  it('merges XML files with empty result', () => {
    // Act
    execCmd(
      `git merge driver run --ancestor-file ${join(EMPTY_TEST_FILES_FOLDER, 'ancestor.xml')} --our-file ${join(EMPTY_TEST_FILES_FOLDER, 'ours.xml')} --theirs-file ${join(EMPTY_TEST_FILES_FOLDER, 'theirs.xml')} --output-file ${join(EMPTY_TEST_FILES_FOLDER, 'output.xml')}`,
      {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      }
    )

    // Assert
    const outputPath = join(ROOT_FOLDER, EMPTY_TEST_FILES_FOLDER, 'output.xml')
    expect(existsSync(outputPath)).to.be.true

    const outputContent = readFileSync(outputPath, 'utf-8')
    expect(outputContent).to.equal('')
  })
})
