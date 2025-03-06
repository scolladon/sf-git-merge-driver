import { appendFile, chmod, copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
const libIndexPath = join(currentDir, '../../lib/index.js')
const binaryPath = 'node_modules/.bin'
const localBinPath = `${binaryPath}/sf-git-merge-driver`

export class InstallService {
  public async installMergeDriver() {
    await mkdir(binaryPath, { recursive: true })
    await copyFile(libIndexPath, localBinPath)
    await chmod(localBinPath, 0o755)

    const git = simpleGit()
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(
      `merge.${DRIVER_NAME}.driver`,
      `${localBinPath} %O %A %B %P`
    )
    await git.addConfig(`merge.${DRIVER_NAME}.recursive`, 'true')

    const content =
      ['*.xml'].map(pattern => `${pattern} merge=${DRIVER_NAME}`).join('\n') +
      '\n'

    await appendFile('.gitattributes', content, { flag: 'a' })
  }
}
