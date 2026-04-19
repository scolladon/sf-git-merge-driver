import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import { DRIVER_NAME } from '../../src/constant/driverConstant.js'

const ROOT_FOLDER = './test/data'
const ATTRS_PATH = join(ROOT_FOLDER, '.git/info/attributes')

const resetRepo = (): void => {
  execSync('shx rm -rf .git', { cwd: ROOT_FOLDER })
  execSync('git init', { cwd: ROOT_FOLDER })
}

const seedAttributes = (content: string): void => {
  execSync('shx mkdir -p .git/info', { cwd: ROOT_FOLDER })
  writeFileSync(ATTRS_PATH, content, 'utf-8')
}

describe('git merge driver uninstall', () => {
  before(() => {
    execSync('git init', {
      cwd: ROOT_FOLDER,
    })
  })

  after(() => {
    // Clean up by removing .git folder and .git/info/attributes file
    execSync('shx rm -rf .git', {
      cwd: ROOT_FOLDER,
    })
  })

  it('uninstalls merge driver correctly', () => {
    // Arrange
    execCmd('git:merge:driver:install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Act
    execCmd('git merge driver uninstall', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert
    const gitattributesPath = join(ROOT_FOLDER, '.git/info/attributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).not.to.include(`*.xml merge=${DRIVER_NAME}`)

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.name`)
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.driver`)
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.recursive`)
  })

  it('uninstalls does nothing when not installed', () => {
    // Act
    execCmd('git merge driver uninstall', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert
    const gitattributesPath = join(ROOT_FOLDER, '.git/info/attributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).not.to.include(`*.xml merge=${DRIVER_NAME}`)

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.name`)
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.driver`)
    expect(gitConfigOutput).not.to.include(`merge.${DRIVER_NAME}.recursive`)
  })

  describe('A8 — combined line preservation', () => {
    it('Given a line like `*.profile-meta.xml text=auto merge=salesforce-source`, When uninstalling, Then `text=auto` survives and only `merge=` is stripped', () => {
      // Arrange
      resetRepo()
      seedAttributes(
        '*.profile-meta.xml text=auto merge=salesforce-source\n* text\n'
      )

      // Act
      execCmd('git merge driver uninstall', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert — the user's other attribute survives; only the merge
      // attribute on our glob is removed.
      const content = readFileSync(ATTRS_PATH, 'utf-8')
      expect(content).to.include('*.profile-meta.xml text=auto')
      expect(content).to.not.include(`merge=${DRIVER_NAME}`)
      // Unrelated rule is untouched
      expect(content).to.include('* text')
    })
  })

  describe('--dry-run', () => {
    it('Given --dry-run after an install, When uninstalling, Then git config and the attributes file are untouched', () => {
      // Arrange — fresh install gives us a known state to preserve
      resetRepo()
      execCmd('git merge driver install', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })
      const installedContent = readFileSync(ATTRS_PATH, 'utf-8')
      const installedConfig = execSync('git config --list', {
        cwd: ROOT_FOLDER,
      }).toString()

      // Act
      const result = execCmd('git merge driver uninstall --dry-run', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert — file and config are byte-for-byte the post-install state
      expect(readFileSync(ATTRS_PATH, 'utf-8')).to.equal(installedContent)
      expect(
        execSync('git config --list', { cwd: ROOT_FOLDER }).toString()
      ).to.equal(installedConfig)
      expect(result.shellOutput.stdout).to.include('DRY RUN')
    })
  })
})
