import { join, resolve } from 'node:path'
import { simpleGit } from 'simple-git'
import { GIT_INFO_ATTRIBUTES_PATH } from '../constant/gitConstant.js'

export async function getGitAttributesPath(): Promise<string> {
  const git = simpleGit()
  // `--git-common-dir` returns the *main* repo's .git for linked
  // worktrees (vs. `--git-dir` which returns the per-worktree dir),
  // so a single install applies across all worktrees of a repository.
  // For non-worktree repos (normal, bare, submodule, custom GIT_DIR)
  // it returns the same value as `--git-dir`, so behaviour is unchanged.
  // Canonicalise the path so a relative or env-supplied GIT_DIR can't
  // resolve outside the repository via traversal components
  // (e.g. GIT_DIR=../..).
  const gitCommonDir = await git.revparse(['--git-common-dir'])
  const absoluteCommonDir = resolve(gitCommonDir.trim())
  return join(absoluteCommonDir, GIT_INFO_ATTRIBUTES_PATH)
}
