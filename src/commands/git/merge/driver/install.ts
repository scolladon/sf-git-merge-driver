import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { DRIVER_NAME } from '../../../../constant/driverConstant.js'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import {
  DRIVER_COMMAND,
  DRIVER_NAME_CONFIG_VALUE,
  InstallConflictError,
  type InstallOutcome,
  InstallService,
} from '../../../../service/InstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages(PLUGIN_NAME, 'install')

const SAMPLE_COUNT = 5

const formatDryRunReport = (outcome: InstallOutcome): string => {
  const { plan, gitAttributesPath } = outcome
  const adds = plan.actions.filter(a => a.kind === 'add')
  const skips = plan.actions.filter(a => a.kind === 'skip')
  const conflicts = plan.actions.flatMap(a =>
    a.kind === 'conflict'
      ? [{ pattern: a.pattern, existingDriver: a.existingDriver }]
      : []
  )
  const dedupCount = plan.dedupDrops.length

  const lines: string[] = []
  lines.push('DRY RUN — no changes applied.')
  lines.push('')
  lines.push('git config:')
  lines.push(
    `  would set merge.${DRIVER_NAME}.name = "${DRIVER_NAME_CONFIG_VALUE}"`
  )
  lines.push(`  would set merge.${DRIVER_NAME}.driver = ${DRIVER_COMMAND}`)
  lines.push('')
  lines.push(`${gitAttributesPath}:`)
  lines.push(`  ${adds.length} rule(s) would be added`)
  if (adds.length > 0) {
    const preview = adds
      .slice(0, SAMPLE_COUNT)
      .map(a => a.pattern)
      .join(', ')
    const more =
      adds.length > SAMPLE_COUNT ? `, … ${adds.length - SAMPLE_COUNT} more` : ''
    lines.push(`    ${preview}${more}`)
  }
  lines.push(`  ${skips.length} rule(s) already present (skipped)`)
  lines.push(`  ${dedupCount} legacy duplicate line(s) would be removed`)
  if (conflicts.length > 0) {
    lines.push('')
    lines.push(
      `⚠ ${conflicts.length} conflict(s) — installation would abort without --on-conflict=skip|overwrite (planned for a later step):`
    )
    for (const c of conflicts) {
      lines.push(`    ${c.pattern} → merge=${c.existingDriver}`)
    }
  }
  return lines.join('\n')
}

export default class Install extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly aliases: string[] = [
    'git:merge:driver:enable',
  ]
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    'dry-run': Flags.boolean({
      summary:
        'Plan the install without writing to git config or .git/info/attributes. Exits 0; shows the list of rules that would be added/skipped/conflict.',
      default: false,
    }),
  }

  @log('Install')
  public async run(): Promise<void> {
    const { flags } = await this.parse(Install)
    const dryRun = flags['dry-run']

    try {
      const outcome = await new InstallService().installMergeDriver({
        dryRun,
      })
      if (dryRun) {
        this.log(formatDryRunReport(outcome))
        return
      }
      Logger.info('Merge driver installed successfully')
    } catch (error) {
      if (error instanceof InstallConflictError) {
        this.error(error.message, { exit: 2 })
      }
      throw error
    }
  }
}
