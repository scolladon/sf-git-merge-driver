/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'

const ROOT_FOLDER = './test/data'
const BIN_FOLDER = 'binTestFiles'
const CONFLICT_BIN_FOLDER = 'binConflictTestFiles'

// Mocha runs NUTs from the repo root, so cwd is the plugin root here.
// (execFileSync below passes its own `cwd`, which only affects the spawned
// subprocess, not this variable.)
const BINARY = resolve(process.cwd(), 'bin', 'merge-driver.cjs')

const setupFixtures = (
  folder: string,
  ancestor: string,
  local: string,
  other: string
): void => {
  mkdirSync(join(ROOT_FOLDER, folder), { recursive: true })
  writeFileSync(join(ROOT_FOLDER, folder, 'ancestor.xml'), ancestor)
  writeFileSync(join(ROOT_FOLDER, folder, 'local.xml'), local)
  writeFileSync(join(ROOT_FOLDER, folder, 'other.xml'), other)
  writeFileSync(join(ROOT_FOLDER, folder, 'output.xml'), local)
}

type SpawnResult = {
  status: number
  stdout: string
  stderr: string
}

const runBinary = (args: string[]): SpawnResult => {
  try {
    const stdout = execFileSync('node', [BINARY, ...args], {
      cwd: ROOT_FOLDER,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout, stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return {
      status: e.status ?? -1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    }
  }
}

describe('bin/merge-driver.cjs', () => {
  before(() => {
    expect(existsSync(BINARY), `binary must exist at ${BINARY}`).to.be.true

    // No-conflict: disjoint edits survive three-way merge
    setupFixtures(
      BIN_FOLDER,
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>false</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>false</readable><editable>true</editable></fieldPermissions></Profile>'
    )

    // Conflict: both sides modify the same leaf
    setupFixtures(
      CONFLICT_BIN_FOLDER,
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>false</editable></fieldPermissions></Profile>',
      '<Profile><fieldPermissions><field>Account.Name</field><readable>false</readable><editable>trueAndFalse</editable></fieldPermissions></Profile>'
    )
  })

  after(() => {
    rmSync(join(ROOT_FOLDER, BIN_FOLDER), { recursive: true, force: true })
    rmSync(join(ROOT_FOLDER, CONFLICT_BIN_FOLDER), {
      recursive: true,
      force: true,
    })
  })

  describe('happy path', () => {
    it('Given disjoint edits, When merging, Then exit 0 and merged content is valid XML', () => {
      const { status, stderr } = runBinary([
        '-O',
        join(BIN_FOLDER, 'ancestor.xml'),
        '-A',
        join(BIN_FOLDER, 'local.xml'),
        '-B',
        join(BIN_FOLDER, 'other.xml'),
        '-P',
        join(BIN_FOLDER, 'output.xml'),
      ])
      expect(status, `stderr: ${stderr}`).to.equal(0)

      const merged = readFileSync(
        join(ROOT_FOLDER, BIN_FOLDER, 'local.xml'),
        'utf-8'
      )
      expect(merged).to.include('<Profile>')
      expect(merged).to.include('Account.Name')
    })
  })

  describe('conflict path', () => {
    it('Given concurrent edits, When merging, Then exit 1 and markers appear in output', () => {
      const { status } = runBinary([
        '-O',
        join(CONFLICT_BIN_FOLDER, 'ancestor.xml'),
        '-A',
        join(CONFLICT_BIN_FOLDER, 'local.xml'),
        '-B',
        join(CONFLICT_BIN_FOLDER, 'other.xml'),
        '-P',
        join(CONFLICT_BIN_FOLDER, 'output.xml'),
      ])
      expect(status).to.equal(1)

      const merged = readFileSync(
        join(ROOT_FOLDER, CONFLICT_BIN_FOLDER, 'local.xml'),
        'utf-8'
      )
      expect(merged).to.include('<<<<<<<')
      expect(merged).to.include('>>>>>>>')
    })

    it('Given custom tag flags, When merging, Then the custom labels appear in markers', () => {
      // Re-seed the local file so the conflict is produced again
      setupFixtures(
        CONFLICT_BIN_FOLDER,
        '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>true</editable></fieldPermissions></Profile>',
        '<Profile><fieldPermissions><field>Account.Name</field><readable>true</readable><editable>false</editable></fieldPermissions></Profile>',
        '<Profile><fieldPermissions><field>Account.Name</field><readable>false</readable><editable>trueAndFalse</editable></fieldPermissions></Profile>'
      )
      const { status } = runBinary([
        '-O',
        join(CONFLICT_BIN_FOLDER, 'ancestor.xml'),
        '-A',
        join(CONFLICT_BIN_FOLDER, 'local.xml'),
        '-B',
        join(CONFLICT_BIN_FOLDER, 'other.xml'),
        '-P',
        join(CONFLICT_BIN_FOLDER, 'output.xml'),
        '-S',
        'MY_BASE',
        '-X',
        'MINE',
        '-Y',
        'YOURS',
      ])
      expect(status).to.equal(1)
      const merged = readFileSync(
        join(ROOT_FOLDER, CONFLICT_BIN_FOLDER, 'local.xml'),
        'utf-8'
      )
      expect(merged).to.include('MINE')
      expect(merged).to.include('MY_BASE')
      expect(merged).to.include('YOURS')
    })
  })

  describe('error paths', () => {
    it('Given no args, When running, Then exit 2 and stderr contains sf-git-merge-driver prefix', () => {
      const { status, stderr } = runBinary([])
      expect(status).to.equal(2)
      expect(stderr).to.match(/^sf-git-merge-driver:/)
    })

    it('Given a non-existent -O file, When running, Then exit 2 and stderr reports the ENOENT system error', () => {
      const { status, stderr } = runBinary([
        '-O',
        'does-not-exist.xml',
        '-A',
        join(BIN_FOLDER, 'local.xml'),
        '-B',
        join(BIN_FOLDER, 'other.xml'),
        '-P',
        join(BIN_FOLDER, 'output.xml'),
      ])
      expect(status).to.equal(2)
      expect(stderr).to.include('ENOENT')
    })

    it('Given unknown flag, When running, Then exit 2 with "unknown argument"', () => {
      const { status, stderr } = runBinary([
        '-Z',
        'value',
        '-O',
        join(BIN_FOLDER, 'ancestor.xml'),
        '-A',
        join(BIN_FOLDER, 'local.xml'),
        '-B',
        join(BIN_FOLDER, 'other.xml'),
        '-P',
        join(BIN_FOLDER, 'output.xml'),
      ])
      expect(status).to.equal(2)
      expect(stderr).to.include('unknown argument')
    })
  })

  describe('metadata', () => {
    it('Given --version, When running, Then exit 0 and stdout is non-empty', () => {
      const { status, stdout } = runBinary(['--version'])
      expect(status).to.equal(0)
      expect(stdout.trim().length).to.be.greaterThan(0)
    })

    it('Given --help, When running, Then exit 0 and stdout lists all flags', () => {
      const { status, stdout } = runBinary(['--help'])
      expect(status).to.equal(0)
      for (const flag of ['-O', '-A', '-B', '-P', '-L', '-S', '-X', '-Y']) {
        expect(stdout).to.include(flag)
      }
    })
  })
})
