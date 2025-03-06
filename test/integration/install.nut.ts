import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import { DRIVER_NAME } from '../../src/constant/driverConstant.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_FOLDER = join(__dirname, '../data')

describe('git merge driver install', () => {
  before(() => {
    execSync('git init', {
      cwd: ROOT_FOLDER,
    })
  })

  after(() => {
    // Clean up by removing .git folder and .gitattributes file
    execSync('rm -rf .git', {
      cwd: ROOT_FOLDER,
    })

    const gitattributesPath = join(ROOT_FOLDER, '.gitattributes')
    if (existsSync(gitattributesPath)) {
      execSync(`rm ${gitattributesPath}`, {
        cwd: ROOT_FOLDER,
      })
    }
  })

  it('installs merge driver correctly', () => {
    // Arrange
    // No specific arrangement needed as we're testing a fresh install

    // Act
    execCmd('git merge driver install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert
    const gitattributesPath = join(ROOT_FOLDER, '.gitattributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).to.include('*.xml merge=salesforce-source')

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.name`)
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.driver`)
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.recursive`)
  })

  it('reinstalls merge driver correctly', () => {
    // Arrange
    // Driver is already installed from previous test

    // Act
    execCmd('git merge driver install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert
    const gitattributesPath = join(ROOT_FOLDER, '.gitattributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).to.include('*.xml merge=salesforce-source')

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.name`)
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.driver`)
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.recursive`)
  })
})
