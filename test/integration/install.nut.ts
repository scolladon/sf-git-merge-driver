import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import {
  DRIVER_NAME,
  RUN_PLUGIN_COMMAND,
} from '../../src/constant/driverConstant.js'

const ROOT_FOLDER = './test/data'

describe('git merge driver install', () => {
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
    execSync('shx rm -rf node_modules', {
      cwd: ROOT_FOLDER,
    })
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
    const gitattributesPath = join(ROOT_FOLDER, '.git/info/attributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).to.include(`.xml merge=${DRIVER_NAME}`)

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.name=Salesforce source merge driver`
    )
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.driver=sh -lc '${RUN_PLUGIN_COMMAND} -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -X "$6" -Y "$7"' -- %O %A %B %P %L %X %Y`
    )
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.recursive=true`)
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
    const gitattributesPath = join(ROOT_FOLDER, '.git/info/attributes')
    expect(existsSync(gitattributesPath)).to.be.true

    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    expect(gitattributesContent).to.include(`.xml merge=${DRIVER_NAME}`)

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.name=Salesforce source merge driver`
    )
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.driver=sh -lc '${RUN_PLUGIN_COMMAND} -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -X "$6" -Y "$7"' -- %O %A %B %P %L %X %Y`
    )
    expect(gitConfigOutput).to.include(`merge.${DRIVER_NAME}.recursive=true`)
  })
})
