import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import { DRIVER_NAME } from '../../src/constant/driverConstant.js'

// The installed driver line now references an absolute path to
// bin/merge-driver.cjs and includes %S (ancestor-conflict-label). Match
// the shape rather than the exact path.
const DRIVER_LINE_PATTERN = new RegExp(
  `^merge\\.${DRIVER_NAME}\\.driver=sh -c 'node ".+/bin/merge-driver\\.cjs" -O "\\$1" -A "\\$2" -B "\\$3" -P "\\$4" -L "\\$5" -S "\\$6" -X "\\$7" -Y "\\$8"' -- %O %A %B %P %L %S %X %Y$`,
  'm'
)

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
    expect(gitConfigOutput).to.match(DRIVER_LINE_PATTERN)
  })

  it('reinstalls merge driver idempotently (no duplicate .gitattributes lines)', () => {
    // Arrange — ensure driver is installed (self-contained, not dependent on prior test)
    execCmd('git merge driver install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Act — install again
    execCmd('git merge driver install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert — .gitattributes has each pattern exactly ONCE (no duplication)
    const gitattributesPath = join(ROOT_FOLDER, '.git/info/attributes')
    const gitattributesContent = readFileSync(gitattributesPath, 'utf-8')
    const lines = gitattributesContent
      .split('\n')
      .filter(l => l.includes(`merge=${DRIVER_NAME}`))
    const uniqueLines = new Set(lines)
    expect(lines.length).to.equal(
      uniqueLines.size,
      `Duplicate .gitattributes lines found:\n${lines.join('\n')}`
    )

    // Assert — git config driver entry present (not duplicated)
    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.name=Salesforce source merge driver`
    )
    expect(gitConfigOutput).to.match(DRIVER_LINE_PATTERN)
  })
})
