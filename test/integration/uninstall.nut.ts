import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import { DRIVER_NAME } from '../../src/constant/driverConstant.js'

const ROOT_FOLDER = './test/data'

describe('git merge driver uninstall', () => {
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

    execSync('rm .gitattributes', {
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
    const gitattributesPath = join(ROOT_FOLDER, '.gitattributes')
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
    const gitattributesPath = join(ROOT_FOLDER, '.gitattributes')
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
})
