import { Messages } from '@salesforce/core'
import { SfCommand } from '@salesforce/sf-plugins-core'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import { InstallService } from '../../../../service/installService.js'
import { UninstallService } from '../../../../service/uninstallService.js'
import { TraceAsyncMethod } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'install')

export default class Install extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {}

  @TraceAsyncMethod
  public async run(): Promise<void> {
    try {
      await new UninstallService().uninstallMergeDriver()
      Logger.info('Previous merge driver uninstalled successfully')
    } catch (error) {
      Logger.warn('Previous merge driver uninstallation failed', error)
    }
    await new InstallService().installMergeDriver()
    Logger.info('Merge driver installed successfully')
  }
}
