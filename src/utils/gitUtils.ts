import { join } from 'node:path'
import { withGitRepository } from '../adapter/TsgitRepository.js'
import { GIT_INFO_ATTRIBUTES_PATH } from '../constant/gitConstant.js'

export async function getGitAttributesPath(): Promise<string> {
  // The shared common dir is the *main* repo's .git for linked
  // worktrees (vs. the per-worktree admin dir), so a single install
  // applies across every worktree of a repository. For normal, bare,
  // submodule and separate-git-dir layouts it is the same directory.
  return withGitRepository(async repo =>
    join(repo.commonGitDir, GIT_INFO_ATTRIBUTES_PATH)
  )
}
