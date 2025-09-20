import { Messages } from '@salesforce/core'
import { SfCommand } from '@salesforce/sf-plugins-core'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import { UninstallService } from '../../../../service/uninstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'uninstall')

export default class Uninstall extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {}

  @log
  public async run(): Promise<void> {
    await new UninstallService().uninstallMergeDriver()
    Logger.info('Merge driver uninstalled successfully')
  }
}
