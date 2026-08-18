import { openRepository } from '@scolladon/tsgit'
import { type GitRepository, NotAGitRepositoryError } from './GitRepository.js'

const TSGIT_ERROR_NAME = 'TsgitError'
const NOT_A_REPOSITORY = 'NOT_A_REPOSITORY'
const REPOSITORY_PROBE_KEY = 'core.repositoryformatversion'
const LOCAL_SCOPE = 'local'

type NotARepositoryError = { readonly data: { readonly path: string } }

const isNotARepositoryError = (
  error: unknown
): error is NotARepositoryError => {
  const candidate = error as
    | { readonly name?: unknown; readonly data?: { readonly code?: unknown } }
    | null
    | undefined
  return (
    candidate?.name === TSGIT_ERROR_NAME &&
    candidate.data?.code === NOT_A_REPOSITORY
  )
}

export const withGitRepository = async <T>(
  use: (repo: GitRepository) => Promise<T>
): Promise<T> => {
  const repo = await openRepository({ hooks: false, command: false })
  try {
    await repo.config.get({ key: REPOSITORY_PROBE_KEY, scope: LOCAL_SCOPE })
    const { commonDir, gitDir } = repo.layout
    return await use({
      commonGitDir: commonDir === undefined ? gitDir : commonDir,
      setConfig: async (key, value) => {
        await repo.config.set({ key, value, scope: LOCAL_SCOPE })
      },
      removeSection: async name => {
        await repo.config.removeSection({ name, scope: LOCAL_SCOPE })
      },
    })
  } catch (error) {
    if (isNotARepositoryError(error)) {
      throw new NotAGitRepositoryError(error.data.path)
    }
    throw error
  } finally {
    await repo.dispose()
  }
}
