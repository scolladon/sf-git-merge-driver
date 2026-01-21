import { appendFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME, RUN_PLUGIN_COMMAND } from '../constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../constant/metadataConstant.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'

export class InstallService {
  @log
  public async installMergeDriver() {
    const git = simpleGit()
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(
      `merge.${DRIVER_NAME}.driver`,
      `sh -c '${RUN_PLUGIN_COMMAND} -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -X "$6" -Y "$7"' -- %O %A %B %P %L %X %Y`
    )

    // Configure merge driver for each metadata type pattern
    const metadataPatterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')

    // Configure merge driver for manifest files (package.xml, destructiveChanges.xml, etc.)
    const manifestPatterns = MANIFEST_PATTERNS.map(
      pattern => `${pattern} merge=${DRIVER_NAME}`
    ).join('\n')

    const content = `${metadataPatterns}\n${manifestPatterns}\n`

    const gitAttributesPath = await getGitAttributesPath()

    await appendFile(gitAttributesPath, content, { flag: 'a' })
  }
}
