import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { GIT_INFO_ATTRIBUTES_PATH } from '../constant/gitConstant.js'

export async function getGitAttributesPath() {
  const git = simpleGit()
  const gitDir = await git.revparse(['--git-dir'])
  return join(gitDir.trim(), GIT_INFO_ATTRIBUTES_PATH)
}
