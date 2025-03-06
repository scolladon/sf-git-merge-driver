import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'

const MERGE_DRIVER_CONFIG = new RegExp(`.* merge\\s*=\\s*${DRIVER_NAME}$`)
const localBinPath = join(
  process.cwd(),
  'node_modules/.bin/sf-git-merge-driver'
)

export class UninstallService {
  public async uninstallMergeDriver() {
    try {
      await unlink(localBinPath)
      // biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
    } catch {}

    const git = simpleGit()
    try {
      await git.raw(['config', '--remove-section', `merge.${DRIVER_NAME}`])
      // biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
    } catch {}

    const gitAttributes = await readFile('.gitattributes', {
      encoding: 'utf8',
    })
    const filteredAttributes = gitAttributes
      .split('\n')
      .filter(line => !MERGE_DRIVER_CONFIG.test(line))
    await writeFile('.gitattributes', filteredAttributes.join('\n'))
  }
}
