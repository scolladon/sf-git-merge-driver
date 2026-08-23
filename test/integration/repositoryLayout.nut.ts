import { execFileSync, execSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import { after, before, beforeEach, describe, it } from 'mocha'
import { DRIVER_NAME } from '../../src/constant/driverConstant.js'

// The installed driver line references an absolute path to
// bin/merge-driver.cjs. Match the shape rather than the exact path.
const DRIVER_LINE_PATTERN = new RegExp(
  `^merge\\.${DRIVER_NAME}\\.driver=sh -c 'node ".+/bin/merge-driver\\.cjs" -O "\\$1" -A "\\$2" -B "\\$3" -P "\\$4" -L "\\$5" -S "\\$6" -X "\\$7" -Y "\\$8"' -- %O %A %B %P %L %S %X %Y$`,
  'm'
)

const gitInit = (dir: string, ...args: string[]): void => {
  execFileSync('git', ['init', '-q', ...args, dir])
}

const commitInitial = (dir: string): void => {
  execFileSync(
    'git',
    [
      '-c',
      'user.email=nut@example.com',
      '-c',
      'user.name=nut',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    ],
    { cwd: dir }
  )
}

describe('git merge driver repository layout contracts', () => {
  // Fixtures must live under os.tmpdir(), never inside this repository —
  // repository discovery walks up from cwd, so a temp dir created inside
  // the worktree would resolve to the plugin's own .git.
  let root: string

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'sfgmd-'))
  })

  after(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
  })

  describe('linked worktree', () => {
    it('Given install run from a linked worktree, When installing, Then the shared common .git is updated and the per-worktree admin dir is not', () => {
      // Arrange
      const main = join(root, 'wt-main')
      const linked = join(root, 'wt-linked')
      gitInit(main)
      commitInitial(main)
      execFileSync(
        'git',
        ['worktree', 'add', '-q', linked, '-b', 'wt-branch'],
        {
          cwd: main,
        }
      )

      // Act — install from the linked worktree
      execCmd('git merge driver install', { ensureExitCode: 0, cwd: linked })

      // Assert — the MAIN repo's shared common dir was updated
      const attrsPath = join(main, '.git', 'info', 'attributes')
      expect(existsSync(attrsPath)).to.be.true
      expect(readFileSync(attrsPath, 'utf-8')).to.include(
        `merge=${DRIVER_NAME}`
      )
      const gitConfigOutput = execSync('git config --local --list', {
        cwd: main,
      }).toString()
      expect(gitConfigOutput).to.include(
        `merge.${DRIVER_NAME}.name=Salesforce source merge driver`
      )
      expect(gitConfigOutput).to.match(DRIVER_LINE_PATTERN)

      // Assert — the linked worktree's own admin dir is a FILE (a
      // gitdir pointer), and the per-worktree admin dir it points at was
      // left alone. Probing `linked/.git/info` would traverse THROUGH that
      // file and be false whatever the driver did, so assert on the real
      // admin dir under the main repo instead.
      expect(statSync(join(linked, '.git')).isFile()).to.be.true
      const linkedAdminDir = join(main, '.git', 'worktrees', basename(linked))
      expect(existsSync(linkedAdminDir)).to.be.true
      expect(existsSync(join(linkedAdminDir, 'info', 'attributes'))).to.be.false
    })
  })

  describe('not a repository', () => {
    let plainDir: string

    beforeEach(() => {
      plainDir = mkdtempSync(join(root, 'plain-'))
    })

    it('Given install --dry-run outside a repository, When running, Then it exits non-zero and writes nothing', () => {
      // Act
      const result = execCmd('git merge driver install --dry-run', {
        ensureExitCode: 'nonZero',
        cwd: plainDir,
      })

      // Assert — the guard fires before any write, and stderr names
      // the offending directory (realpath-resolved, so match the
      // basename rather than the exact string we created)
      expect(existsSync(join(plainDir, '.git'))).to.be.false
      expect(readdirSync(plainDir)).to.be.empty
      expect(result.shellOutput.stderr).to.include('not a git repository')
      expect(result.shellOutput.stderr).to.include(basename(plainDir))
    })

    it('Given install outside a repository, When running, Then it exits non-zero and writes nothing', () => {
      // Act
      const result = execCmd('git merge driver install', {
        ensureExitCode: 'nonZero',
        cwd: plainDir,
      })

      // Assert
      expect(existsSync(join(plainDir, '.git'))).to.be.false
      expect(readdirSync(plainDir)).to.be.empty
      expect(result.shellOutput.stderr).to.include('not a git repository')
      expect(result.shellOutput.stderr).to.include(basename(plainDir))
    })

    it('Given uninstall outside a repository, When running, Then the best-effort guard reports success and writes nothing', () => {
      // Act
      execCmd('git merge driver uninstall', {
        ensureExitCode: 0,
        cwd: plainDir,
      })

      // Assert
      expect(existsSync(join(plainDir, '.git'))).to.be.false
      expect(readdirSync(plainDir)).to.be.empty
    })
  })

  describe('bare repository', () => {
    let bareDir: string

    before(() => {
      bareDir = join(root, 'bare.git')
      gitInit(bareDir, '--bare')
      // Unrelated local config. Uninstall now rewrites .git/config through
      // tsgit's own INI writer rather than shelling out to git, so the
      // section removal must be proven surgical.
      execFileSync('git', ['config', 'user.name', 'nut-keeper'], {
        cwd: bareDir,
      })
      execFileSync('git', ['config', 'alias.st', 'status'], { cwd: bareDir })
    })

    it('Given a bare repository, When installing then uninstalling, Then the driver is configured and later fully removed', () => {
      // Act — install
      execCmd('git merge driver install', {
        ensureExitCode: 0,
        cwd: bareDir,
      })

      // Assert — the bare repo's own info/attributes carries the rule
      const attrsPath = join(bareDir, 'info', 'attributes')
      expect(existsSync(attrsPath)).to.be.true
      expect(readFileSync(attrsPath, 'utf-8')).to.include(
        `merge=${DRIVER_NAME}`
      )

      // Assert — real git config, read back through the git binary,
      // reports the exact driver command
      const driverConfig = execFileSync(
        'git',
        ['config', '--get', `merge.${DRIVER_NAME}.driver`],
        { cwd: bareDir }
      ).toString()
      expect(`merge.${DRIVER_NAME}.driver=${driverConfig}`).to.match(
        DRIVER_LINE_PATTERN
      )

      // Act — uninstall
      execCmd('git merge driver uninstall', {
        ensureExitCode: 0,
        cwd: bareDir,
      })

      // Assert — the [merge "salesforce-source"] section is gone
      const gitConfigOutput = execSync('git config --local --list', {
        cwd: bareDir,
      }).toString()
      expect(gitConfigOutput).to.not.include(`merge.${DRIVER_NAME}`)

      // Assert — unrelated sections survived the rewrite. Without this the
      // absence check above would also pass against a wiped config.
      expect(gitConfigOutput).to.include('user.name=nut-keeper')
      expect(gitConfigOutput).to.include('alias.st=status')
    })
  })

  describe('ambient GIT_DIR', () => {
    it('Given GIT_DIR pointing at another repository, When installing, Then the cwd repository is used and the pointed-at one is untouched', () => {
      // Arrange
      const cwdRepo = join(root, 'env-cwd')
      const otherRepo = join(root, 'env-other')
      gitInit(cwdRepo)
      gitInit(otherRepo)

      // Act
      execCmd('git merge driver install', {
        ensureExitCode: 0,
        cwd: cwdRepo,
        env: { ...process.env, GIT_DIR: join(otherRepo, '.git') },
      })

      // Assert — the rule landed in the cwd repository
      expect(existsSync(join(cwdRepo, '.git', 'info', 'attributes'))).to.be.true

      // Assert — the GIT_DIR target was not touched
      expect(existsSync(join(otherRepo, '.git', 'info', 'attributes'))).to.be
        .false
      const otherConfig = execSync('git config --local --list', {
        cwd: otherRepo,
      }).toString()
      expect(otherConfig).to.not.include(`merge.${DRIVER_NAME}`)
    })
  })
})
