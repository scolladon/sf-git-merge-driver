import { appendFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME, RUN_PLUGIN_COMMAND } from '../constant/driverConstant.js'

export class InstallService {
  public async installMergeDriver() {
    const git = simpleGit()
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(
      `merge.${DRIVER_NAME}.driver`,
      `${RUN_PLUGIN_COMMAND} --ancestor-file %O --our-file %A --theirs-file %B --output-file %P`
    )
    await git.addConfig(`merge.${DRIVER_NAME}.recursive`, 'true')

    const content =
      ['*.xml'].map(pattern => `${pattern} merge=${DRIVER_NAME}`).join('\n') +
      '\n'

    await appendFile('.gitattributes', content, { flag: 'a' })
  }
}
