import { describe, expect, it } from 'vitest'
import type {
  InstallPlan,
  UninstallPlan,
} from '../../../src/service/GitAttributesPlanner.js'
import {
  formatInstallDryRunReport,
  formatUninstallDryRunReport,
  shouldPromptForPolicy,
} from '../../../src/service/InstallReports.js'
import type { InstallOutcome } from '../../../src/service/InstallService.js'
import type { UninstallOutcome } from '../../../src/service/UninstallService.js'

const makeInstallPlan = (
  overrides: Partial<InstallPlan> = {}
): InstallPlan => ({
  actions: [],
  dedupDrops: [],
  textAttributeWarnings: [],
  commentedOutWarnings: [],
  ...overrides,
})

const makeInstallOutcome = (plan: InstallPlan): InstallOutcome => ({
  plan,
  dryRun: true,
  wroteAttributes: false,
  gitAttributesPath: '.git/info/attributes',
})

const makeUninstallPlan = (
  overrides: Partial<UninstallPlan> = {}
): UninstallPlan => ({
  actions: [],
  ...overrides,
})

const makeUninstallOutcome = (plan: UninstallPlan): UninstallOutcome => ({
  plan,
  dryRun: true,
  wroteAttributes: false,
  removedConfigSection: false,
  gitAttributesPath: '.git/info/attributes',
})

describe('InstallReports.shouldPromptForPolicy', () => {
  it('Given dryRun=true, Then returns false regardless of TTY', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: true,
        force: false,
        onConflict: 'abort',
        isTTY: true,
      })
    ).toBe(false)
  })

  it('Given force=true, Then returns false (force implies overwrite)', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: false,
        force: true,
        onConflict: 'abort',
        isTTY: true,
      })
    ).toBe(false)
  })

  it('Given onConflict=skip (non-abort), Then returns false (user already chose)', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: false,
        force: false,
        onConflict: 'skip',
        isTTY: true,
      })
    ).toBe(false)
  })

  it('Given onConflict=overwrite, Then returns false', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: false,
        force: false,
        onConflict: 'overwrite',
        isTTY: true,
      })
    ).toBe(false)
  })

  it('Given onConflict=abort + isTTY=false (CI), Then returns false (no hidden prompt in CI)', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: false,
        force: false,
        onConflict: 'abort',
        isTTY: false,
      })
    ).toBe(false)
  })

  it('Given onConflict=abort + isTTY=true + no force + no dryRun, Then returns true', () => {
    expect(
      shouldPromptForPolicy({
        dryRun: false,
        force: false,
        onConflict: 'abort',
        isTTY: true,
      })
    ).toBe(true)
  })
})

describe('InstallReports.formatInstallDryRunReport', () => {
  // Helper: the two header lines are shared across every scenario.
  // Pinning them once lets the scenario tests focus on per-plan deltas.
  const EXPECTED_HEADER_START =
    'DRY RUN — no changes applied.\n\ngit config:\n  would set merge.salesforce-source.name = "Salesforce source merge driver"\n  would set merge.salesforce-source.driver = '
  const EXPECTED_PATH_LINE = '\n\n.git/info/attributes:\n'

  it('Given an empty plan, Then the entire report body is the zero-counts skeleton (no extra blocks)', () => {
    // Arrange
    const outcome = makeInstallOutcome(makeInstallPlan())

    // Act
    const report = formatInstallDryRunReport(outcome)

    // Assert — whole-string equality against the expected skeleton,
    // not just substring presence. Mutations that drop any literal or
    // change any count are caught here.
    const rest = report.slice(report.indexOf(EXPECTED_PATH_LINE))
    expect(report.startsWith(EXPECTED_HEADER_START)).toBe(true)
    expect(rest).toBe(
      '\n\n.git/info/attributes:\n  0 rule(s) would be added\n  0 rule(s) already present (skipped)\n  0 legacy duplicate line(s) would be removed'
    )
  })

  const bodyOf = (report: string): string =>
    report.slice(report.indexOf(EXPECTED_PATH_LINE) + EXPECTED_PATH_LINE.length)

  it('Given ≤5 adds, Then the preview line lists every pattern with no "more" suffix', () => {
    const plan = makeInstallPlan({
      actions: [
        { kind: 'add', pattern: '*.profile-meta.xml' },
        { kind: 'add', pattern: '*.permissionset-meta.xml' },
      ],
    })
    expect(bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))).toBe(
      '  2 rule(s) would be added\n' +
        '    *.profile-meta.xml, *.permissionset-meta.xml\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed'
    )
  })

  it('Given >5 adds, Then the preview shows exactly the first 5 patterns plus a "… N more" suffix with the correct count', () => {
    const patterns = [
      '*.a-meta.xml',
      '*.b-meta.xml',
      '*.c-meta.xml',
      '*.d-meta.xml',
      '*.e-meta.xml',
      '*.f-meta.xml',
      '*.g-meta.xml',
    ]
    const plan = makeInstallPlan({
      actions: patterns.map(p => ({ kind: 'add', pattern: p }) as const),
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  7 rule(s) would be added\n' +
        '    *.a-meta.xml, *.b-meta.xml, *.c-meta.xml, *.d-meta.xml, *.e-meta.xml, … 2 more\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed'
    )
  })

  it('Given exactly 5 adds, Then NO "more" suffix appears (boundary — the > check must be strict, not >=)', () => {
    const plan = makeInstallPlan({
      actions: [
        { kind: 'add', pattern: '*.a-meta.xml' },
        { kind: 'add', pattern: '*.b-meta.xml' },
        { kind: 'add', pattern: '*.c-meta.xml' },
        { kind: 'add', pattern: '*.d-meta.xml' },
        { kind: 'add', pattern: '*.e-meta.xml' },
      ],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).not.toContain('more')
    expect(body).toContain(
      '    *.a-meta.xml, *.b-meta.xml, *.c-meta.xml, *.d-meta.xml, *.e-meta.xml'
    )
  })

  it('Given `conflict` actions, Then the abort-block text is byte-exact', () => {
    const plan = makeInstallPlan({
      actions: [
        {
          kind: 'conflict',
          pattern: '*.profile-meta.xml',
          existingDriver: 'tool-a',
          lineIndex: 0,
        },
      ],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed\n' +
        '\n' +
        '⚠ 1 conflict(s) — installation would abort. Re-run with --on-conflict=skip or --on-conflict=overwrite (or --force) to proceed:\n' +
        '    *.profile-meta.xml → merge=tool-a'
    )
  })

  it('Given `skip-conflict` actions, Then the skip-block text is byte-exact', () => {
    const plan = makeInstallPlan({
      actions: [
        {
          kind: 'skip-conflict',
          pattern: '*.profile-meta.xml',
          existingDriver: 'tool-b',
          lineIndex: 0,
        },
      ],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed\n' +
        '\n' +
        '1 conflict(s) left to their current driver (--on-conflict=skip):\n' +
        '    *.profile-meta.xml → merge=tool-b'
    )
  })

  it('Given `overwrite` actions, Then the overwrite-block text is byte-exact and mentions uninstall restore', () => {
    const plan = makeInstallPlan({
      actions: [
        {
          kind: 'overwrite',
          pattern: '*.profile-meta.xml',
          existingDriver: 'tool-c',
          lineIndex: 0,
          originalRaw: '*.profile-meta.xml merge=tool-c',
        },
      ],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed\n' +
        '\n' +
        '1 conflict(s) would be overwritten (--on-conflict=overwrite); uninstall will restore them:\n' +
        '    *.profile-meta.xml (was merge=tool-c)'
    )
  })

  it('Given textAttributeWarnings, Then the -text block text is byte-exact and line number is 1-based', () => {
    const plan = makeInstallPlan({
      textAttributeWarnings: [{ pattern: '*.profile-meta.xml', lineIndex: 4 }],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed\n' +
        '\n' +
        '⚠ 1 pattern(s) marked -text (binary) — driver will be inactive on these until you remove -text:\n' +
        '    *.profile-meta.xml (line 5)'
    )
  })

  it('Given commentedOutWarnings, Then the info-block text is byte-exact and line number is 1-based', () => {
    const plan = makeInstallPlan({
      commentedOutWarnings: [{ pattern: '*.profile-meta.xml', lineIndex: 2 }],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed\n' +
        '\n' +
        'ℹ 1 commented-out driver line(s) detected — install will add a live rule below each; consider removing the commented lines:\n' +
        '    *.profile-meta.xml (line 3)'
    )
  })

  it('Given dedupDrops, Then the count is surfaced exactly', () => {
    const plan = makeInstallPlan({ dedupDrops: [1, 4] })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  0 rule(s) already present (skipped)\n' +
        '  2 legacy duplicate line(s) would be removed'
    )
  })

  it('Given `skip` actions, Then the already-present count is accurate', () => {
    const plan = makeInstallPlan({
      actions: [
        { kind: 'skip', pattern: '*.a-meta.xml', lineIndex: 0 },
        { kind: 'skip', pattern: '*.b-meta.xml', lineIndex: 1 },
      ],
    })
    const body = bodyOf(formatInstallDryRunReport(makeInstallOutcome(plan)))
    expect(body).toBe(
      '  0 rule(s) would be added\n' +
        '  2 rule(s) already present (skipped)\n' +
        '  0 legacy duplicate line(s) would be removed'
    )
  })
})

describe('InstallReports.formatUninstallDryRunReport', () => {
  it('Given an empty plan, Then the entire report body is the zero-counts skeleton with NO restore line', () => {
    // Arrange
    const outcome = makeUninstallOutcome(makeUninstallPlan())

    // Act
    const report = formatUninstallDryRunReport(outcome)

    // Assert — whole-string equality pins every literal. Any mutation
    // (dropping a line, changing a count word, flipping a plural) is
    // caught here. Uses the git-config section that names the driver.
    expect(report).toBe(
      'DRY RUN — no changes applied.\n' +
        '\n' +
        'git config:\n' +
        '  would remove section merge.salesforce-source\n' +
        '\n' +
        '.git/info/attributes:\n' +
        '  0 line(s) would be removed (pure driver lines)\n' +
        '  0 line(s) would be rewritten (combined lines — user attrs preserved)'
    )
  })

  it('Given drop-line + remove-merge-attr actions, Then the body reports exact counts byte-for-byte', () => {
    const plan = makeUninstallPlan({
      actions: [
        { kind: 'drop-line', lineIndex: 0 },
        { kind: 'drop-line', lineIndex: 1 },
        { kind: 'remove-merge-attr', lineIndex: 2 },
      ],
    })
    const report = formatUninstallDryRunReport(makeUninstallOutcome(plan))
    expect(report).toBe(
      'DRY RUN — no changes applied.\n' +
        '\n' +
        'git config:\n' +
        '  would remove section merge.salesforce-source\n' +
        '\n' +
        '.git/info/attributes:\n' +
        '  2 line(s) would be removed (pure driver lines)\n' +
        '  1 line(s) would be rewritten (combined lines — user attrs preserved)'
    )
  })

  it('Given restore-overwrite actions, Then the dedicated restore block is appended byte-exact', () => {
    const plan = makeUninstallPlan({
      actions: [
        { kind: 'drop-line', lineIndex: 0 }, // the annotation comment
        {
          kind: 'restore-overwrite',
          lineIndex: 1,
          originalRaw: '*.profile-meta.xml merge=some-other',
        },
      ],
    })
    const report = formatUninstallDryRunReport(makeUninstallOutcome(plan))
    expect(report).toBe(
      'DRY RUN — no changes applied.\n' +
        '\n' +
        'git config:\n' +
        '  would remove section merge.salesforce-source\n' +
        '\n' +
        '.git/info/attributes:\n' +
        '  1 line(s) would be removed (pure driver lines)\n' +
        '  0 line(s) would be rewritten (combined lines — user attrs preserved)\n' +
        '  1 line(s) would be restored from overwrite annotations'
    )
  })

  it('Given gitAttributesPath is undefined, Then the path line uses the ".git/info/attributes" default literal exactly', () => {
    const plan = makeUninstallPlan()
    const outcome: UninstallOutcome = {
      ...makeUninstallOutcome(plan),
      gitAttributesPath: undefined,
    }
    const report = formatUninstallDryRunReport(outcome)
    // Whole-string equality proves the `?? '.git/info/attributes'`
    // fallback fires — mutation of either side of the ?? is caught.
    expect(report).toBe(
      'DRY RUN — no changes applied.\n' +
        '\n' +
        'git config:\n' +
        '  would remove section merge.salesforce-source\n' +
        '\n' +
        '.git/info/attributes:\n' +
        '  0 line(s) would be removed (pure driver lines)\n' +
        '  0 line(s) would be rewritten (combined lines — user attrs preserved)'
    )
  })

  it('Given gitAttributesPath is a custom absolute path, Then the path line uses that literal (proves the ?? left-hand wins)', () => {
    const plan = makeUninstallPlan()
    const outcome: UninstallOutcome = {
      ...makeUninstallOutcome(plan),
      gitAttributesPath: '/custom/path/attributes',
    }
    const report = formatUninstallDryRunReport(outcome)
    expect(report).toContain('/custom/path/attributes:')
    expect(report).not.toContain('.git/info/attributes:')
  })
})
