import {
  type OpenRepositoryOptions,
  openRepository,
  type Repository,
  TsgitError,
} from '@scolladon/tsgit'
import { commonDirOf } from '@scolladon/tsgit/primitives'
import { Logger } from '../utils/LoggingService.js'
import { type GitRepository, NotAGitRepositoryError } from './GitRepository.js'

const NOT_A_REPOSITORY = 'NOT_A_REPOSITORY'
const REPOSITORY_PROBE_KEY = 'core.repositoryformatversion'
const LOCAL_SCOPE = 'local'
const DISPOSE_FAILURE_MESSAGE = 'Failed to dispose the git repository handle'

const isNotARepositoryError = (
  error: unknown
): error is TsgitError & { data: { code: typeof NOT_A_REPOSITORY } } =>
  error instanceof TsgitError && error.data.code === NOT_A_REPOSITORY

const asGitRepository = (repo: Repository): GitRepository => ({
  commonGitDir: commonDirOf(repo.layout),
  setConfig: async (key, value) => {
    await repo.config.set({ key, value, scope: LOCAL_SCOPE })
  },
  removeSection: async name => {
    await repo.config.removeSection({ name, scope: LOCAL_SCOPE })
  },
})

// Disposal must never replace an in-flight error: a rejecting `dispose` would
// otherwise mask the mapped NotAGitRepositoryError the caller needs to see.
// The payload is flattened because the logger JSON-serialises it: an Error's
// message and stack are non-enumerable, so passing one raw persists `{}` and
// a non-serialisable value would throw from inside this catch.
const disposeQuietly = async (repo: Repository): Promise<void> => {
  try {
    await repo.dispose()
  } catch (error) {
    Logger.error(DISPOSE_FAILURE_MESSAGE, {
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

// tsgit reads no environment variable of its own, so honouring git's layout
// variables is this adapter's job. `GIT_DIR` overrides discovery from the
// working directory; `GIT_COMMON_DIR` independently overrides where the
// shared, non-worktree files (config, info/attributes) live. Empty values are
// treated as unset, matching git. Unlike git, tsgit does not validate the
// targets at open time — the repository probe below is what refuses a bogus
// one.
const fromEnv = (name: string): string | undefined => {
  const value = process.env[name]
  return value === '' ? undefined : value
}

const explicitLayout = (): Pick<
  OpenRepositoryOptions,
  'gitDir' | 'commonDir'
> => {
  const gitDir = fromEnv('GIT_DIR')
  const commonDir = fromEnv('GIT_COMMON_DIR')
  return {
    ...(gitDir === undefined ? {} : { gitDir }),
    ...(commonDir === undefined ? {} : { commonDir }),
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
    repo = await openRepository({
      ...explicitLayout(),
      hooks: false,
      command: false,
    })
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
