import { appendFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME, RUN_PLUGIN_COMMAND } from '../constant/driverConstant.js'
import { METADATA_TYPES_PATTERNS } from '../constant/metadataConstant.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'

export class InstallService {
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
    await git.addConfig(`merge.${DRIVER_NAME}.recursive`, 'true')

    // Configure merge driver for each metadata type pattern
    const patterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')
    const content = `${patterns}\n`

    const gitAttributesPath = await getGitAttributesPath()

    await appendFile(gitAttributesPath, content, { flag: 'a' })
  }
}
