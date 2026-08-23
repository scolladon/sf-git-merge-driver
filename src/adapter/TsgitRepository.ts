import { openRepository, type Repository, TsgitError } from '@scolladon/tsgit'
import { Logger } from '../utils/LoggingService.js'
import { type GitRepository, NotAGitRepositoryError } from './GitRepository.js'

const NOT_A_REPOSITORY = 'NOT_A_REPOSITORY'
const REPOSITORY_PROBE_KEY = 'core.repositoryformatversion'
const LOCAL_SCOPE = 'local'

const isNotARepositoryError = (
  error: unknown
): error is TsgitError & { data: { code: typeof NOT_A_REPOSITORY } } =>
  error instanceof TsgitError && error.data.code === NOT_A_REPOSITORY

// `commonDir` is absent for a normal repo and the main worktree, and set only
// for a linked worktree. Spelled as an explicit conditional rather than `??`
// so the two arms stay independently observable.
const commonGitDirOf = (layout: Repository['layout']): string =>
  layout.commonDir === undefined ? layout.gitDir : layout.commonDir

const asGitRepository = (repo: Repository): GitRepository => ({
  commonGitDir: commonGitDirOf(repo.layout),
  setConfig: async (key, value) => {
    await repo.config.set({ key, value, scope: LOCAL_SCOPE })
  },
  removeSection: async name => {
    await repo.config.removeSection({ name, scope: LOCAL_SCOPE })
  },
})

// Disposal must never replace an in-flight error: a rejecting `dispose` would
// otherwise mask the mapped NotAGitRepositoryError the caller needs to see.
const disposeQuietly = async (repo: Repository): Promise<void> => {
  try {
    await repo.dispose()
  } catch (error) {
    Logger.error('Failed to dispose the git repository handle', error)
  }
}

export const withGitRepository = async <T>(
  use: (repo: GitRepository) => Promise<T>
): Promise<T> => {
  let repo: Repository | undefined
  try {
    // `openRepository` succeeds outside a repository, returning a synthetic
    // layout, so the probe below — not the open — is what proves we are in
    // one. The open can still reject on a structurally broken layout.
    repo = await openRepository({ hooks: false, command: false })
    await repo.config.get({ key: REPOSITORY_PROBE_KEY, scope: LOCAL_SCOPE })
    return await use(asGitRepository(repo))
  } catch (error) {
    if (isNotARepositoryError(error)) {
      throw new NotAGitRepositoryError(error.data.path)
    }
    throw error
  } finally {
    if (repo !== undefined) await disposeQuietly(repo)
  }
}
