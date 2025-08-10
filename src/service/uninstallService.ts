import { readFile, writeFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'

// This match lines like: "*.profile-meta.xml merge=sf-git-merge-driver"
const MERGE_DRIVER_CONFIG = new RegExp(`.*\s+merge\s*=\s*${DRIVER_NAME}$`)

export class UninstallService {
  public async uninstallMergeDriver() {
    const git = simpleGit()
    try {
      // Throw when the merge driver is not installed
      await git.raw(['config', '--remove-section', `merge.${DRIVER_NAME}`])

      const gitAttributesPath = await getGitAttributesPath()
      // Throw when the file does not exist
      const gitAttributes = await readFile(gitAttributesPath, {
        encoding: 'utf8',
      })
      const filteredAttributes = gitAttributes
        .split('\n')
        .filter(line => !MERGE_DRIVER_CONFIG.test(line))
      await writeFile(gitAttributesPath, filteredAttributes.join('\n'))
      // biome-ignore lint/suspicious/noEmptyBlockStatements: fail silently
    } catch {}
  }
}
