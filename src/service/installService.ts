import { appendFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME, RUN_PLUGIN_COMMAND } from '../constant/driverConstant.js'
import { METADATA_TYPES_PATTERNS } from '../constant/metadataConstant.js'

export class InstallService {
  public async installMergeDriver() {
    const git = simpleGit()
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(
      `merge.${DRIVER_NAME}.driver`,
      `${RUN_PLUGIN_COMMAND} -O %O -A %A -B %B -P %P -L %L -X %X -Y %Y`
    )
    await git.addConfig(`merge.${DRIVER_NAME}.recursive`, 'true')

    // Configure merge driver for each metadata type pattern
    const patterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')
    const content = `${patterns}\n`

    await appendFile('.gitattributes', content, { flag: 'a' })
  }
}
