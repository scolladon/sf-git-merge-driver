import { appendFile } from 'node:fs/promises'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'

export class InstallService {
  public async installMergeDriver() {
    const git = simpleGit()

    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(
      `merge.${DRIVER_NAME}.driver`,
      'node ${__dirname}/index.js %O %A %B %P' // TODO define how to do that
    )
    await git.addConfig(`merge.${DRIVER_NAME}.recursive`, 'true') // TO CHALLENGE if needed

    const content =
      ['*.xml'].map(pattern => `${pattern} merge=${DRIVER_NAME}`).join('\n') +
      '\n'

    await appendFile('.gitattributes', content, { flag: 'a' })
  }
}
