import { join, resolve } from 'node:path'
import { simpleGit } from 'simple-git'
import { GIT_INFO_ATTRIBUTES_PATH } from '../constant/gitConstant.js'

export async function getGitAttributesPath(): Promise<string> {
  const git = simpleGit()
  const gitDir = await git.revparse(['--git-dir'])
  // Canonicalise the path so a relative or env-supplied GIT_DIR can't resolve
  // outside the repository via traversal components (e.g. GIT_DIR=../..).
  const absoluteGitDir = resolve(gitDir.trim())
  return join(absoluteGitDir, GIT_INFO_ATTRIBUTES_PATH)
}
