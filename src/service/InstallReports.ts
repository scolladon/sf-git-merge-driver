import { DRIVER_NAME } from '../constant/driverConstant.js'
import type { ConflictPolicy } from './GitAttributesPlanner.js'
import {
  DRIVER_COMMAND,
  DRIVER_NAME_CONFIG_VALUE,
  type InstallOutcome,
} from './InstallService.js'
import type { UninstallOutcome } from './UninstallService.js'

/**
 * Human-readable dry-run report formatters. Factored out of the oclif
 * command classes so they can be unit-tested directly — the command
 * `run()` method is covered only by NUT tests, but the report text is
 * user-facing and deserves a fast feedback loop.
 */

const SAMPLE_COUNT = 5

/**
 * Predicate: should the install command prompt the user interactively
 * for a conflict policy? Pure function — the caller injects the flag
 * state and the TTY gate so this stays testable.
 */
export const shouldPromptForPolicy = (input: {
  readonly dryRun: boolean
  readonly force: boolean
  readonly onConflict: ConflictPolicy
  readonly isTTY: boolean
}): boolean => {
  if (input.dryRun) return false
  if (input.force) return false
  if (input.onConflict !== 'abort') return false
  return input.isTTY
}

export const formatInstallDryRunReport = (outcome: InstallOutcome): string => {
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
  if (plan.textAttributeWarnings.length > 0) {
    lines.push('')
    lines.push(
      `⚠ ${plan.textAttributeWarnings.length} pattern(s) marked -text (binary) — driver will be inactive on these until you remove -text:`
    )
    for (const w of plan.textAttributeWarnings) {
      lines.push(`    ${w.pattern} (line ${w.lineIndex + 1})`)
    }
  }
  if (plan.commentedOutWarnings.length > 0) {
    lines.push('')
    lines.push(
      `ℹ ${plan.commentedOutWarnings.length} commented-out driver line(s) detected — install will add a live rule below each; consider removing the commented lines:`
    )
    for (const w of plan.commentedOutWarnings) {
      lines.push(`    ${w.pattern} (line ${w.lineIndex + 1})`)
    }
  }
  return lines.join('\n')
}

export const formatUninstallDryRunReport = (
  outcome: UninstallOutcome
): string => {
  const { plan, gitAttributesPath } = outcome
  const dropCount = plan.actions.filter(a => a.kind === 'drop-line').length
  const rewriteCount = plan.actions.filter(
    a => a.kind === 'remove-merge-attr'
  ).length
  const restoreCount = plan.actions.filter(
    a => a.kind === 'restore-overwrite'
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
  if (restoreCount > 0) {
    lines.push(
      `  ${restoreCount} line(s) would be restored from overwrite annotations`
    )
  }
  return lines.join('\n')
}
