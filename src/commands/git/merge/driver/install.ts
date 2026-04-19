import { createInterface } from 'node:readline'
import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { DRIVER_NAME } from '../../../../constant/driverConstant.js'
import { PLUGIN_NAME } from '../../../../constant/pluginConstant.js'
import type { ConflictPolicy } from '../../../../service/GitAttributesPlanner.js'
import {
  DRIVER_COMMAND,
  DRIVER_NAME_CONFIG_VALUE,
  InstallConflictError,
  type InstallOutcome,
  InstallService,
} from '../../../../service/InstallService.js'
import { log } from '../../../../utils/LoggingDecorator.js'
import { Logger } from '../../../../utils/LoggingService.js'

type PolicyPrompt = (
  conflicts: readonly {
    pattern: string
    existingDriver: string
  }[]
) => Promise<ConflictPolicy>

/**
 * Ask the user on stdin how to handle conflicts. Invoked only when
 * `--on-conflict` is unset AND stdout is a TTY AND the planner emitted
 * conflict actions. Kept as a dependency-injectable function so tests
 * can drive the command without opening a real readline.
 */
const defaultPolicyPrompt: PolicyPrompt = async conflicts => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    process.stdout.write(
      `\n${conflicts.length} pattern(s) already configured with a different merge driver:\n`
    )
    for (const c of conflicts) {
      process.stdout.write(`  ${c.pattern} → merge=${c.existingDriver}\n`)
    }
    process.stdout.write(
      '\nHow should we proceed?\n' +
        '  [a] abort     (safe, no changes)\n' +
        '  [s] skip      (leave those globs with the other driver)\n' +
        '  [o] overwrite (replace; uninstall will restore)\n'
    )
    const answer = await new Promise<string>(resolve => {
      rl.question('Enter a / s / o [a]: ', resolve)
    })
    const normalised = answer.trim().toLowerCase()
    if (normalised === 's' || normalised === 'skip') return 'skip'
    if (normalised === 'o' || normalised === 'overwrite') return 'overwrite'
    return 'abort'
  } finally {
    rl.close()
  }
}

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
  const skippedConflicts = plan.actions.flatMap(a =>
    a.kind === 'skip-conflict'
      ? [{ pattern: a.pattern, existingDriver: a.existingDriver }]
      : []
  )
  const overwrites = plan.actions.flatMap(a =>
    a.kind === 'overwrite'
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
  if (skippedConflicts.length > 0) {
    lines.push('')
    lines.push(
      `${skippedConflicts.length} conflict(s) left to their current driver (--on-conflict=skip):`
    )
    for (const c of skippedConflicts) {
      lines.push(`    ${c.pattern} → merge=${c.existingDriver}`)
    }
  }
  if (overwrites.length > 0) {
    lines.push('')
    lines.push(
      `${overwrites.length} conflict(s) would be overwritten (--on-conflict=overwrite); uninstall will restore them:`
    )
    for (const c of overwrites) {
      lines.push(`    ${c.pattern} (was merge=${c.existingDriver})`)
    }
  }
  if (conflicts.length > 0) {
    lines.push('')
    lines.push(
      `⚠ ${conflicts.length} conflict(s) — installation would abort. Re-run with --on-conflict=skip or --on-conflict=overwrite (or --force) to proceed:`
    )
    for (const c of conflicts) {
      lines.push(`    ${c.pattern} → merge=${c.existingDriver}`)
    }
  }
  return lines.join('\n')
}

const CONFLICT_POLICIES: readonly ConflictPolicy[] = [
  'abort',
  'skip',
  'overwrite',
]

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
    'on-conflict': Flags.option({
      summary:
        'How to handle patterns already owned by another merge driver in .git/info/attributes. Default: abort (refuse to change anything).',
      options: CONFLICT_POLICIES,
      default: 'abort' as ConflictPolicy,
    })(),
    force: Flags.boolean({
      summary:
        'Alias for --on-conflict=overwrite. Non-interactive shortcut for CI.',
      default: false,
    }),
  }

  /**
   * Hook for tests — overrides the interactive prompt implementation.
   * Kept protected so test doubles can swap in without going through
   * readline. In production, stdout-isTTY is the gate; in tests the
   * caller supplies a stub.
   */
  protected promptPolicy: PolicyPrompt = defaultPolicyPrompt

  /**
   * True when the interactive policy prompt should run: `--on-conflict`
   * unset (still 'abort' default), `--force` unset, stdout is a TTY.
   * Non-TTY (CI) invocations without the flag keep the strict abort
   * default so nothing surprising happens in automation.
   */
  private shouldPromptForPolicy(flags: {
    'on-conflict': ConflictPolicy
    force: boolean
    'dry-run': boolean
  }): boolean {
    if (flags['dry-run']) return false
    if (flags.force) return false
    if (flags['on-conflict'] !== 'abort') return false
    return Boolean(process.stdout.isTTY)
  }

  @log('Install')
  public async run(): Promise<void> {
    const { flags } = await this.parse(Install)
    const dryRun = flags['dry-run']

    // First pass: use the requested policy directly unless we need to
    // surface conflicts to a human first.
    let onConflict: ConflictPolicy = flags.force
      ? 'overwrite'
      : flags['on-conflict']

    if (this.shouldPromptForPolicy(flags)) {
      // Run a cheap dry-run first so we know whether to prompt at all.
      const preview = await new InstallService().installMergeDriver({
        dryRun: true,
      })
      const conflicts = preview.plan.actions.flatMap(a =>
        a.kind === 'conflict'
          ? [{ pattern: a.pattern, existingDriver: a.existingDriver }]
          : []
      )
      if (conflicts.length > 0) {
        onConflict = await this.promptPolicy(conflicts)
      }
    }

    try {
      const outcome = await new InstallService().installMergeDriver({
        dryRun,
        onConflict,
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
