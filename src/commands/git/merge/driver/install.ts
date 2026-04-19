import { Messages } from '@salesforce/core'
import { SfCommand } from '@salesforce/sf-plugins-core'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import {
  InstallConflictError,
  InstallService,
} from '../../../../service/InstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'install')

export default class Install extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly aliases: string[] = [
    'git:merge:driver:enable',
  ]
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {}

  @log('Install')
  public async run(): Promise<void> {
    // `InstallService` is now idempotent by plan: re-running it reads the
    // attributes file, compares against the desired pattern set, and only
    // writes when something is missing. No need for the previous
    // "uninstall first, then append" dance — that pattern destroyed user
    // attributes on combined lines and always emitted a stray uninstall
    // error on fresh installs.
    try {
      await new InstallService().installMergeDriver()
      Logger.info('Merge driver installed successfully')
    } catch (error) {
      if (error instanceof InstallConflictError) {
        // Conflicts are a user-actionable state, not a crash — surface
        // the list and exit non-zero. Step 5 adds --on-conflict to let
        // users pick skip/overwrite semantics instead of the default
        // strict abort.
        this.error(error.message, { exit: 2 })
      }
      throw error
    }
  }
}
