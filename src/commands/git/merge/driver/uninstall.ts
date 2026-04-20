import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import { formatUninstallDryRunReport } from '../../../../service/InstallReports.js'
import { UninstallService } from '../../../../service/UninstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'uninstall')

export default class Uninstall extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')
  public static override readonly aliases: string[] = [
    'git:merge:driver:disable',
  ]

  public static override readonly flags = {
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      default: false,
    }),
  }

  @log('Uninstall')
  public async run(): Promise<void> {
    const { flags } = await this.parse(Uninstall)
    const dryRun = flags['dry-run']

    const outcome = await new UninstallService().uninstallMergeDriver({
      dryRun,
    })
    if (dryRun) {
      this.log(formatUninstallDryRunReport(outcome))
      return
    }
    Logger.info('Merge driver uninstalled successfully')
  }
}
