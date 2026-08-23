import { FilePath, TsgitError } from '@scolladon/tsgit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRepository } from '../../../src/adapter/GitRepository.js'
import { NotAGitRepositoryError } from '../../../src/adapter/GitRepository.js'
import { withGitRepository } from '../../../src/adapter/TsgitRepository.js'
import { Logger } from '../../../src/utils/LoggingService.js'

const { openRepositoryMock } = vi.hoisted(() => ({
  openRepositoryMock: vi.fn(),
}))

vi.mock('../../../src/utils/LoggingService.js', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../../src/utils/LoggingService.js')
    >()
  return { ...actual, Logger: { ...actual.Logger, error: vi.fn() } }
})

vi.mock('@scolladon/tsgit', async importOriginal => ({
  ...(await importOriginal<typeof import('@scolladon/tsgit')>()),
  openRepository: (...args: unknown[]) => openRepositoryMock(...args),
}))

type FakeLayout = {
  readonly gitDir: string
  readonly commonDir?: string
}

type FakeRepo = {
  readonly layout: FakeLayout
  readonly config: {
    readonly get: ReturnType<typeof vi.fn>
    readonly set: ReturnType<typeof vi.fn>
    readonly removeSection: ReturnType<typeof vi.fn>
  }
  readonly dispose: ReturnType<typeof vi.fn>
}

const makeRepo = (layout: FakeLayout): FakeRepo => ({
  layout: Object.freeze(layout),
  config: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    removeSection: vi.fn().mockResolvedValue(undefined),
  },
  dispose: vi.fn().mockResolvedValue(undefined),
})

describe('TsgitRepository.withGitRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('given a layout with no commonDir', () => {
    it('should expose commonGitDir equal to layout.gitDir', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(
        async gitRepo => gitRepo.commonGitDir
      )

      // Assert
      expect(result).toBe('/repo/.git')
    })
  })

  describe('given a layout with commonDir (linked worktree)', () => {
    it('should expose commonGitDir equal to layout.commonDir', async () => {
      // Arrange
      const repo = makeRepo({
        gitDir: '/repo/.git/worktrees/wt',
        commonDir: '/repo/.git',
      })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(
        async gitRepo => gitRepo.commonGitDir
      )

      // Assert
      expect(result).toBe('/repo/.git')
    })
  })

  describe('given any invocation', () => {
    it('should call openRepository with exactly hooks:false and command:false', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async () => undefined)

      // Assert
      expect(openRepositoryMock).toHaveBeenCalledWith({
        hooks: false,
        command: false,
      })
    })

    it('should probe config.get with exactly key core.repositoryformatversion and scope local', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async () => undefined)

      // Assert
      expect(repo.config.get).toHaveBeenCalledWith({
        key: 'core.repositoryformatversion',
        scope: 'local',
      })
    })
  })

  describe('given the probe rejects with a NOT_A_REPOSITORY tsgit error', () => {
    it('should throw a NotAGitRepositoryError carrying the path and never invoke use, but still dispose', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/x/.git' })
      repo.config.get.mockRejectedValue(
        new TsgitError({ code: 'NOT_A_REPOSITORY', path: FilePath.from('/x') })
      )
      openRepositoryMock.mockResolvedValue(repo)
      const use = vi.fn()

      // Act
      const error = await withGitRepository(use).catch(e => e)

      // Assert
      expect(error).toBeInstanceOf(NotAGitRepositoryError)
      expect((error as NotAGitRepositoryError).path).toBe('/x')
      expect((error as NotAGitRepositoryError).name).toBe(
        'NotAGitRepositoryError'
      )
      expect((error as NotAGitRepositoryError).message).toBe(
        'not a git repository: /x — ' +
          'run this command from inside a git working tree'
      )
      expect(use).not.toHaveBeenCalled()
      expect(repo.dispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('given the probe rejects with a CONFIG_SECTION_NOT_FOUND tsgit error', () => {
    it('should rethrow the same error instance unchanged', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      const rejection = new TsgitError({
        code: 'CONFIG_SECTION_NOT_FOUND',
        name: 'merge.salesforce-source',
        scope: 'local',
      })
      repo.config.get.mockRejectedValue(rejection)
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const error = await withGitRepository(async () => undefined).catch(e => e)

      // Assert
      expect(error).toBe(rejection)
    })
  })

  describe('given the probe rejects with a non-tsgit NOT_A_REPOSITORY look-alike', () => {
    it('should rethrow the error unchanged', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      const rejection = {
        name: 'TsgitError',
        data: { code: 'NOT_A_REPOSITORY', path: '/x' },
      }
      repo.config.get.mockRejectedValue(rejection)
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const error = await withGitRepository(async () => undefined).catch(e => e)

      // Assert
      expect(error).toBe(rejection)
    })
  })

  describe('given the probe rejects with a plain Error', () => {
    it('should rethrow the error unchanged', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      const rejection = new Error('boom')
      repo.config.get.mockRejectedValue(rejection)
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const error = await withGitRepository(async () => undefined).catch(e => e)

      // Assert
      expect(error).toBe(rejection)
    })
  })

  describe('given the probe rejects with undefined', () => {
    it('should rethrow undefined unchanged', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      repo.config.get.mockRejectedValue(undefined)
      openRepositoryMock.mockResolvedValue(repo)

      // Act & Assert
      await expect(
        withGitRepository(async () => undefined)
      ).rejects.toBeUndefined()
    })
  })

  describe('given use resolves with a value', () => {
    it('should return that value and dispose exactly once', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(async () => 'value')

      // Assert
      expect(result).toBe('value')
      expect(repo.dispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('given use rejects', () => {
    it('should propagate the rejection and still dispose', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)
      const rejection = new Error('use failed')

      // Act
      const error = await withGitRepository(async () => {
        throw rejection
      }).catch(e => e)

      // Assert
      expect(error).toBe(rejection)
      expect(repo.dispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('given setConfig is called from inside use', () => {
    it('should call repo.config.set with exactly key, value and scope local', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async gitRepo => {
        await gitRepo.setConfig('k', 'v')
      })

      // Assert
      expect(repo.config.set).toHaveBeenCalledWith({
        key: 'k',
        value: 'v',
        scope: 'local',
      })
    })
  })

  describe('given removeSection is called from inside use', () => {
    it('should call repo.config.removeSection with exactly name and scope local', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async gitRepo => {
        await gitRepo.removeSection('merge.x')
      })

      // Assert
      expect(repo.config.removeSection).toHaveBeenCalledWith({
        name: 'merge.x',
        scope: 'local',
      })
    })
  })

  describe('given openRepository itself rejects', () => {
    it('should propagate the rejection without ever disposing a handle', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      const rejection = new Error('open failed')
      openRepositoryMock.mockRejectedValue(rejection)

      // Act
      const error = await withGitRepository(
        async (_gitRepo: GitRepository) => undefined
      ).catch(e => e)

      // Assert
      expect(error).toBe(rejection)
      expect(repo.dispose).not.toHaveBeenCalled()
    })
  })
  describe('given openRepository itself rejects with NOT_A_REPOSITORY', () => {
    it('should map it to NotAGitRepositoryError and dispose nothing', async () => {
      // Arrange
      const rejection = new TsgitError({
        code: 'NOT_A_REPOSITORY',
        path: FilePath.from('/gone'),
      })
      openRepositoryMock.mockRejectedValue(rejection)

      // Act
      const result = await withGitRepository(async () => undefined).catch(
        e => e
      )

      // Assert
      expect(result).toBeInstanceOf(NotAGitRepositoryError)
      expect((result as NotAGitRepositoryError).path).toBe('/gone')
      expect(Logger.error).not.toHaveBeenCalled()
    })
  })

  describe('given dispose rejects while an error is already in flight', () => {
    it('should surface the original error, not the dispose failure', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/x/.git' })
      repo.config.get.mockRejectedValue(
        new TsgitError({ code: 'NOT_A_REPOSITORY', path: FilePath.from('/x') })
      )
      repo.dispose.mockRejectedValue(new Error('dispose exploded'))
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(async () => undefined).catch(
        e => e
      )

      // Assert
      expect(result).toBeInstanceOf(NotAGitRepositoryError)
      expect((result as Error).message).not.toContain('dispose exploded')
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to dispose the git repository handle',
        { reason: 'dispose exploded' }
      )
    })
  })

  describe('given dispose rejects on the happy path', () => {
    it('should still return the value produced by use', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      repo.dispose.mockRejectedValue(new Error('dispose exploded'))
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(async () => 'value')

      // Assert
      expect(result).toBe('value')
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to dispose the git repository handle',
        { reason: 'dispose exploded' }
      )
    })
  })

  describe('given dispose rejects with a non-Error value', () => {
    it('should still log a serialisable reason', async () => {
      // Arrange
      const repo = makeRepo({ gitDir: '/repo/.git' })
      repo.dispose.mockRejectedValue('plain string failure')
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      const result = await withGitRepository(async () => 'value')

      // Assert
      expect(result).toBe('value')
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to dispose the git repository handle',
        { reason: 'plain string failure' }
      )
    })
  })
  describe('given GIT_DIR is set in the environment', () => {
    it('should forward it to openRepository as an explicit gitDir', async () => {
      // Arrange
      vi.stubEnv('GIT_DIR', '/elsewhere/.git')
      const repo = makeRepo({ gitDir: '/elsewhere/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async gitRepo => gitRepo.commonGitDir)

      // Assert
      expect(openRepositoryMock.mock.calls[0]?.[0]).toStrictEqual({
        gitDir: '/elsewhere/.git',
        hooks: false,
        command: false,
      })
      vi.unstubAllEnvs()
    })
  })

  describe('given GIT_DIR is set to an empty string', () => {
    it('should treat it as unset, exactly as git does', async () => {
      // Arrange
      vi.stubEnv('GIT_DIR', '')
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async gitRepo => gitRepo.commonGitDir)

      // Assert
      expect(openRepositoryMock.mock.calls[0]?.[0]).toStrictEqual({
        hooks: false,
        command: false,
      })
      vi.unstubAllEnvs()
    })
  })

  describe('given GIT_DIR is absent', () => {
    it('should open by discovery from the working directory', async () => {
      // Arrange
      vi.stubEnv('GIT_DIR', undefined)
      const repo = makeRepo({ gitDir: '/repo/.git' })
      openRepositoryMock.mockResolvedValue(repo)

      // Act
      await withGitRepository(async gitRepo => gitRepo.commonGitDir)

      // Assert
      expect(openRepositoryMock.mock.calls[0]?.[0]).toStrictEqual({
        hooks: false,
        command: false,
      })
      vi.unstubAllEnvs()
    })
  })
})
