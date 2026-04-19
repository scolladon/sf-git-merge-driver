import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
const ATTRS_PATH = join(ROOT_FOLDER, '.git/info/attributes')

const resetRepo = (): void => {
  execSync('shx rm -rf .git', { cwd: ROOT_FOLDER })
  execSync('git init', { cwd: ROOT_FOLDER })
}

const seedAttributes = (content: string): void => {
  execSync('shx mkdir -p .git/info', { cwd: ROOT_FOLDER })
  writeFileSync(ATTRS_PATH, content, 'utf-8')
}

describe('git merge driver install', () => {
  before(() => {
    execSync('git init', {
      cwd: ROOT_FOLDER,
    })
  })

  after(() => {
    execSync('shx rm -rf .git', { cwd: ROOT_FOLDER })
    execSync('shx rm -rf node_modules', { cwd: ROOT_FOLDER })
  })

  it('installs merge driver correctly', () => {
    // Act
    execCmd('git merge driver install', {
      ensureExitCode: 0,
      cwd: ROOT_FOLDER,
    })

    // Assert
    expect(existsSync(ATTRS_PATH)).to.be.true

    const gitattributesContent = readFileSync(ATTRS_PATH, 'utf-8')
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
    const gitattributesContent = readFileSync(ATTRS_PATH, 'utf-8')
    const lines = gitattributesContent
      .split('\n')
      .filter(l => l.includes(`merge=${DRIVER_NAME}`))
    const uniqueLines = new Set(lines)
    expect(lines.length).to.equal(
      uniqueLines.size,
      `Duplicate .gitattributes lines found:\n${lines.join('\n')}`
    )

    const gitConfigOutput = execSync('git config --list', {
      cwd: ROOT_FOLDER,
    }).toString()
    expect(gitConfigOutput).to.include(
      `merge.${DRIVER_NAME}.name=Salesforce source merge driver`
    )
    expect(gitConfigOutput).to.match(DRIVER_LINE_PATTERN)
  })

  describe('--dry-run', () => {
    it('Given --dry-run on a fresh repo, When installing, Then nothing is written and git config is NOT changed', () => {
      // Arrange — reset to a pristine repo so we can observe that
      // no write happens.
      resetRepo()

      // Act
      const result = execCmd('git merge driver install --dry-run', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert — no attributes file created
      expect(existsSync(ATTRS_PATH)).to.be.false

      // Assert — no merge section added to git config
      const gitConfigOutput = execSync('git config --list', {
        cwd: ROOT_FOLDER,
      }).toString()
      expect(gitConfigOutput).to.not.include(`merge.${DRIVER_NAME}.name`)

      // Assert — the dry-run report mentions the pattern count
      expect(result.shellOutput.stdout).to.include('DRY RUN')
      expect(result.shellOutput.stdout).to.include('rule(s) would be added')
    })
  })

  describe('--on-conflict', () => {
    it('Given a pre-existing `merge=<other>` on our glob, When installing without a flag, Then exits 2 with a clear conflict message and leaves the file UNTOUCHED', () => {
      // Arrange
      resetRepo()
      const seed = '*.profile-meta.xml merge=some-other-tool\n'
      seedAttributes(seed)

      // Act
      const result = execCmd('git merge driver install', {
        ensureExitCode: 2,
        cwd: ROOT_FOLDER,
      })

      // Assert — file unchanged
      expect(readFileSync(ATTRS_PATH, 'utf-8')).to.equal(seed)

      // Assert — stderr explains why
      expect(result.shellOutput.stderr).to.include('already owned by')
      expect(result.shellOutput.stderr).to.include('some-other-tool')
    })

    it('Given --on-conflict=skip, When installing, Then the user line is preserved and our driver is NOT added for that glob', () => {
      // Arrange
      resetRepo()
      seedAttributes('*.profile-meta.xml merge=some-other-tool\n')

      // Act
      execCmd('git merge driver install --on-conflict=skip', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert — their line intact, our driver NOT added for that glob
      const content = readFileSync(ATTRS_PATH, 'utf-8')
      expect(content).to.include('*.profile-meta.xml merge=some-other-tool')
      const ours = content
        .split('\n')
        .filter(l => l === `*.profile-meta.xml merge=${DRIVER_NAME}`)
      expect(ours).to.have.lengthOf(0)
    })

    it('Given --on-conflict=overwrite followed by uninstall, Then the user line is restored byte-for-byte (annotation round-trip)', () => {
      // Arrange
      resetRepo()
      const seed = '*.profile-meta.xml merge=some-other-tool\n'
      seedAttributes(seed)

      // Act
      execCmd('git merge driver install --on-conflict=overwrite', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })
      const afterInstall = readFileSync(ATTRS_PATH, 'utf-8')
      expect(afterInstall).to.include('# sf-git-merge-driver overwrote:')
      expect(afterInstall).to.include(`*.profile-meta.xml merge=${DRIVER_NAME}`)

      execCmd('git merge driver uninstall', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert — their line restored byte-for-byte
      expect(readFileSync(ATTRS_PATH, 'utf-8')).to.equal(seed)
    })

    it('Given --force, When installing against a conflict, Then it behaves like --on-conflict=overwrite', () => {
      // Arrange
      resetRepo()
      seedAttributes('*.profile-meta.xml merge=some-other-tool\n')

      // Act
      execCmd('git merge driver install --force', {
        ensureExitCode: 0,
        cwd: ROOT_FOLDER,
      })

      // Assert
      expect(readFileSync(ATTRS_PATH, 'utf-8')).to.include(
        '# sf-git-merge-driver overwrote:'
      )
    })
  })
})
