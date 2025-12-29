import { readFile, writeFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import { GIT_EOL } from '../constant/gitConstant.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'

// This match lines like: "*.profile-meta.xml merge=sf-git-merge-driver"
const MERGE_DRIVER_CONFIG = new RegExp(
  String.raw`.*\s+merge\s*=\s*${DRIVER_NAME}\s*$`
)

export class UninstallService {
  @log
  public async uninstallMergeDriver() {
    const git = simpleGit()
    try {
      // Throws when the merge driver is not installed
      await git.raw(['config', '--remove-section', `merge.${DRIVER_NAME}`])
    } catch (error) {
      Logger.error(
        'Merge driver uninstallation failed to cleanup git config',
        error
      )
    }

    try {
      const gitAttributesPath = await getGitAttributesPath()
      // Throws when the file does not exist
      const gitAttributes = await readFile(gitAttributesPath, {
        encoding: 'utf8',
      })
      const filteredAttributes = gitAttributes
        .split(GIT_EOL)
        .filter(line => !MERGE_DRIVER_CONFIG.test(line))
      await writeFile(gitAttributesPath, filteredAttributes.join(GIT_EOL))
    } catch (error) {
      Logger.error(
        'Merge driver uninstallation failed to cleanup git attributes',
        error
      )
    }
  }
}
