import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { DRIVER_NAME } from '../../../../constant/driverConstant.js'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import {
  type UninstallOutcome,
  UninstallService,
} from '../../../../service/UninstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'uninstall')

const formatDryRunReport = (outcome: UninstallOutcome): string => {
  const { plan, gitAttributesPath } = outcome
  const dropCount = plan.actions.filter(a => a.kind === 'drop-line').length
  const rewriteCount = plan.actions.filter(
    a => a.kind === 'remove-merge-attr'
  ).length

  const lines: string[] = []
  lines.push('DRY RUN — no changes applied.')
  lines.push('')
  lines.push('git config:')
  lines.push(`  would remove section merge.${DRIVER_NAME}`)
  lines.push('')
  lines.push(`${gitAttributesPath ?? '.git/info/attributes'}:`)
  lines.push(`  ${dropCount} line(s) would be removed (pure driver lines)`)
  lines.push(
    `  ${rewriteCount} line(s) would be rewritten (combined lines — user attrs preserved)`
  )
  return lines.join('\n')
}

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
      summary:
        'Plan the uninstall without touching git config or .git/info/attributes. Exits 0; shows what would be removed.',
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
      this.log(formatDryRunReport(outcome))
      return
    }
    Logger.info('Merge driver uninstalled successfully')
  }
}
