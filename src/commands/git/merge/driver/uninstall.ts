import { Messages } from '@salesforce/core'
import { SfCommand } from '@salesforce/sf-plugins-core'
import { UninstallService } from '../../../../service/uninstallService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('sf-git-merge-driver', 'uninstall')

export default class Uninstall extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {}

  public async run(): Promise<void> {
    await new UninstallService().uninstallMergeDriver()
  }
}
