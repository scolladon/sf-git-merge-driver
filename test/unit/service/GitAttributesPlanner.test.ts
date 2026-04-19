import { describe, expect, it } from 'vitest'
import {
  type InstallPlan,
  planInstall,
  planUninstall,
  type UninstallPlan,
} from '../../../src/service/GitAttributesPlanner.js'
import { applyInstallPlan } from '../../../src/service/InstallService.js'
import { applyUninstallPlan } from '../../../src/service/UninstallService.js'
import { parse, serialise } from '../../../src/utils/gitAttributesFile.js'

/**
 * Apply helpers reuse the services' real `applyInstallPlan` /
 * `applyUninstallPlan` so these tests cannot drift against production
 * behaviour. The previous local reimplementations are gone — drift
 * was hiding a real bug (restore-overwrite actions were silently
 * ignored at the test level).
 */
const applyPlan = (input: string, plan: UninstallPlan): string => {
  const parsed = parse(input)
  const nextLines = applyUninstallPlan(parsed.lines, plan)
  return serialise({ ...parsed, lines: nextLines })
}

describe('GitAttributesPlanner.planUninstall', () => {
  describe('no-op cases', () => {
    it('Given an empty file, When planning uninstall, Then no actions are emitted', () => {
      // Arrange
      const pf = parse('')

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([])
    })

    it('Given a file with only unrelated rules, When planning uninstall, Then no actions are emitted', () => {
      // Arrange
      const pf = parse('* text=auto\n*.sh text eol=lf\n')

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([])
    })

    it('Given a file with rules for other merge drivers, When planning uninstall, Then no actions are emitted', () => {
      // Arrange
      const pf = parse('*.profile-meta.xml merge=some-other-tool\n')

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([])
    })
  })

  describe('pure driver lines', () => {
    it('Given a line containing ONLY our merge driver, When planning, Then action is drop-line', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 0 }])
      expect(applyPlan(input, plan)).toBe('')
    })

    it('Given multiple pure driver lines interleaved with user content, When planning, Then each pure line is dropped, user content preserved', () => {
      // Arrange
      const input =
        '* text=auto\n*.profile-meta.xml merge=salesforce-source\n*.sh text\n*.permissionset-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'drop-line', lineIndex: 1 },
        { kind: 'drop-line', lineIndex: 3 },
      ])
      expect(applyPlan(input, plan)).toBe('* text=auto\n*.sh text\n')
    })
  })

  describe('A8 — combined lines (user attributes + our merge)', () => {
    it('Given a combined line with our merge driver, When planning, Then action is remove-merge-attr (not drop-line) and the user attributes survive serialisation', () => {
      // Arrange
      const input =
        '*.profile-meta.xml text=auto eol=lf merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)

      // Assert — the line stays; only the merge attribute is removed
      expect(plan.actions).toEqual([
        { kind: 'remove-merge-attr', lineIndex: 0 },
      ])
      const applied = applyPlan(input, plan)
      expect(applied).toContain('*.profile-meta.xml')
      expect(applied).toContain('text=auto')
      expect(applied).toContain('eol=lf')
      expect(applied).not.toContain('merge=salesforce-source')
    })

    it('Given a combined line where our merge is the only surviving attribute after removal, When planning, Then action is remove-merge-attr (not drop-line)', () => {
      // Rationale: when attrs are reduced to zero, we keep the line as
      // malformed rather than silently deleting; user-intent signal
      // ("I cared about this pattern") is preserved. Uninstall is
      // conservative about destroying lines.
      // Arrange — one user attr + our merge
      const input = '*.profile-meta.xml text merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'remove-merge-attr', lineIndex: 0 },
      ])
    })
  })

  describe('comments and commented-out driver lines', () => {
    it('Given a commented-out driver line, When planning, Then no actions are emitted (comment stays)', () => {
      // Arrange — A9 scenario from the spike
      const input = '# *.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)

      // Assert — commented line is not a rule, planner ignores it
      expect(plan.actions).toEqual([])
    })
  })

  describe('A10 — CRLF preservation', () => {
    it('Given a CRLF file with a pure driver line, When applying the plan, Then the remaining file keeps CRLF endings', () => {
      // Arrange
      const input =
        '* text=auto\r\n*.profile-meta.xml merge=salesforce-source\r\n'
      const pf = parse(input)

      // Act
      const plan = planUninstall(pf)
      const applied = applyPlan(input, plan)

      // Assert
      expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 1 }])
      expect(applied).toBe('* text=auto\r\n')
      expect(applied).not.toContain('\n\n') // no mixed EOL artefacts
    })
  })
})

/**
 * planInstall decides, for each pattern we want to own, whether to add a
 * new line, silently dedup existing ones, or flag a conflict with
 * another tool. Apply helper reuses the real service function.
 */
const applyInstallPlanToString = (input: string, plan: InstallPlan): string => {
  const parsed = parse(input)
  return serialise(applyInstallPlan(parsed, plan))
}

describe('GitAttributesPlanner.planInstall', () => {
  describe('A1/A2 — empty or missing file', () => {
    it('Given an empty file, When planning install, Then every pattern gets an `add` action', () => {
      // Arrange
      const pf = parse('')
      const patterns = ['*.profile-meta.xml', '*.permissionset-meta.xml']

      // Act
      const plan = planInstall(pf, patterns)

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'add', pattern: '*.profile-meta.xml' },
        { kind: 'add', pattern: '*.permissionset-meta.xml' },
      ])
      expect(plan.dedupDrops).toEqual([])
    })
  })

  describe('A3 — file has rules on non-overlapping globs', () => {
    it('Given unrelated rules, When planning install, Then only `add` actions for our patterns; user content untouched', () => {
      // Arrange
      const input = '* text=auto eol=lf\n*.sh text\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'add', pattern: '*.profile-meta.xml' },
      ])
      const applied = applyInstallPlanToString(input, plan)
      expect(applied).toBe(
        '* text=auto eol=lf\n*.sh text\n*.profile-meta.xml merge=salesforce-source\n'
      )
    })
  })

  describe('A4 — idempotent re-install', () => {
    it('Given our rule is already present, When planning install, Then action is `skip` (no add, no conflict)', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
      expect(plan.dedupDrops).toEqual([])
    })
  })

  describe('dedup — legacy duplicates', () => {
    it('Given the same `pattern merge=salesforce-source` line appears twice, When planning install, Then the extra copy is silently dropped (skip + dedup)', () => {
      // Arrange — the shape left behind by a previous buggy install path
      const input =
        '*.profile-meta.xml merge=salesforce-source\n*.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert — skip the first, dedup the second; no-log-required healing
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
      expect(plan.dedupDrops).toEqual([1])
      const applied = applyInstallPlanToString(input, plan)
      expect(applied).toBe('*.profile-meta.xml merge=salesforce-source\n')
    })

    it('Given three duplicate copies, When planning install, Then two are dedup-dropped', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=salesforce-source\n'.repeat(3)
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.dedupDrops).toEqual([1, 2])
    })
  })

  describe('A6 — conflict with another merge driver', () => {
    it('Given `merge=<other>` on our glob, When planning install, Then action is `conflict` carrying the existing driver name', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=some-other-tool\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.actions).toEqual([
        {
          kind: 'conflict',
          pattern: '*.profile-meta.xml',
          existingDriver: 'some-other-tool',
          lineIndex: 0,
        },
      ])
    })

    it('Given OUR driver appears first and another driver second on the same pattern, When planning, Then the action is `skip` (ours), not `conflict`', () => {
      // Guards the "merge !== DRIVER_NAME" filter used when picking
      // the conflict line — if that predicate were stripped, the
      // planner would incorrectly flag this as a conflict.
      const pf = parse(
        '*.profile-meta.xml merge=salesforce-source\n*.profile-meta.xml merge=some-other-tool\n'
      )

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert — our rule wins on first match; the conflict filter
      // correctly excludes our own driver when scanning for others.
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })
  })

  describe('A7 — user has non-merge attributes on our glob', () => {
    it('Given a rule with text/eol but no merge, When planning install, Then `add` is emitted (new line; git accumulates attrs across lines)', () => {
      // Arrange
      const input = '*.profile-meta.xml text=auto eol=lf\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'add', pattern: '*.profile-meta.xml' },
      ])
      const applied = applyInstallPlanToString(input, plan)
      expect(applied).toBe(
        '*.profile-meta.xml text=auto eol=lf\n*.profile-meta.xml merge=salesforce-source\n'
      )
    })
  })

  describe('A8 — user has combined merge=ours + other attrs', () => {
    it('Given a combined line, When planning install, Then action is `skip` (we are already the configured driver)', () => {
      // Arrange
      const input = '*.profile-meta.xml text=auto merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'abort')

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })
  })

  describe('mixed pattern set', () => {
    it('Given a mix of absent / already-ours / conflicting patterns, When planning install, Then each pattern gets its correct action independently', () => {
      // Arrange
      const input =
        '*.profile-meta.xml merge=salesforce-source\n' +
        '*.permissionset-meta.xml merge=some-other-tool\n'
      const pf = parse(input)
      const patterns = [
        '*.profile-meta.xml',
        '*.permissionset-meta.xml',
        '*.labels-meta.xml',
      ]

      // Act
      const plan = planInstall(pf, patterns)

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
        {
          kind: 'conflict',
          pattern: '*.permissionset-meta.xml',
          existingDriver: 'some-other-tool',
          lineIndex: 1,
        },
        { kind: 'add', pattern: '*.labels-meta.xml' },
      ])
    })
  })

  describe('planInstall+applyInstallPlan integration — overwrite + dedup round-trip', () => {
    it('Given policy=overwrite on a conflicting file, When the plan is applied and then planUninstall runs, Then the original user driver is restored byte-identical', () => {
      // Arrange — the seed is what a real user would have before our
      // first install under --on-conflict=overwrite.
      const seed = '*.profile-meta.xml merge=user-driver\n'
      const pf = parse(seed)

      // Act — install with overwrite + apply
      const installPlan = planInstall(pf, ['*.profile-meta.xml'], 'overwrite')
      expect(installPlan.actions).toHaveLength(1)
      expect(installPlan.actions[0]?.kind).toBe('overwrite')
      const afterInstall = serialise(applyInstallPlan(pf, installPlan))
      expect(afterInstall).toContain(
        '# sf-git-merge-driver overwrote: *.profile-meta.xml merge=user-driver'
      )
      expect(afterInstall).toContain(
        '*.profile-meta.xml merge=salesforce-source'
      )

      // Act — uninstall + apply
      const afterInstallParsed = parse(afterInstall)
      const uninstallPlan = planUninstall(afterInstallParsed)
      const afterUninstall = serialise({
        ...afterInstallParsed,
        lines: applyUninstallPlan(afterInstallParsed.lines, uninstallPlan),
      })

      // Assert — seed restored byte-identical
      expect(afterUninstall).toBe(seed)
    })
  })

  describe('non-rule lines in the file', () => {
    it('Given the file has comments and blanks, When planning install, Then they are ignored by the pattern index (not misinterpreted as rules)', () => {
      // Arrange — the indexRulesByPattern pass must skip comment/blank
      // lines cleanly so their line indices never leak into actions.
      const input = '# header\n\n*.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert — skip action references the rule line (index 2), not the
      // comment or blank that precede it.
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 2 },
      ])
    })
  })

  describe('dedup filter — only-our-driver duplicates are counted', () => {
    it('Given the same pattern has both our rule and another rule without merge, When planning install, Then the non-ours rule is NOT dedup-dropped', () => {
      // Arrange — first rule is ours, second rule is on the same pattern
      // but carries user attributes (no merge token). That second rule
      // should survive — dedup only targets redundant copies of OUR
      // driver, not unrelated user rules on the same pattern.
      const input =
        '*.profile-meta.xml merge=salesforce-source\n' +
        '*.profile-meta.xml text=auto\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.actions).toEqual([
        { kind: 'skip', pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
      expect(plan.dedupDrops).toEqual([])
    })
  })

  describe('conflict policy — skip', () => {
    it('Given a conflicting driver with policy=skip, When planning, Then action is `skip-conflict` (no `conflict`, no `add`)', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=some-other-tool\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'skip')

      // Assert — planner downgrades the conflict to a skip-conflict
      // action so the service writes nothing for this pattern. The
      // other-tool line remains the source of truth for that glob.
      expect(plan.actions).toEqual([
        {
          kind: 'skip-conflict',
          pattern: '*.profile-meta.xml',
          existingDriver: 'some-other-tool',
          lineIndex: 0,
        },
      ])
    })
  })

  describe('conflict policy — overwrite', () => {
    it('Given a conflicting driver with policy=overwrite, When planning, Then action is `overwrite` carrying the original raw line', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=some-other-tool\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'], 'overwrite')

      // Assert — planner records the original line so the applier can
      // write an annotation comment alongside the replacement. The
      // annotation lets `uninstall` restore the prior driver.
      expect(plan.actions).toEqual([
        {
          kind: 'overwrite',
          pattern: '*.profile-meta.xml',
          existingDriver: 'some-other-tool',
          lineIndex: 0,
          originalRaw: '*.profile-meta.xml merge=some-other-tool',
        },
      ])
    })
  })

  describe('A9 — commented-out driver line (user disabled us)', () => {
    it('Given a commented-out driver line for one of our patterns, When planning install, Then a warning is surfaced and the pattern is still added (live rule lives below the comment)', () => {
      // Arrange — `# *.profile-meta.xml merge=salesforce-source` shouldn't
      // prevent us from re-adding the live rule, but it's useful to
      // surface because users who manually disabled us will see two
      // lines after install and wonder why.
      const input = '# *.profile-meta.xml merge=salesforce-source\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert — live rule is added; commented-out warning is recorded
      // in the plan so the command can log it.
      expect(plan.actions).toEqual([
        { kind: 'add', pattern: '*.profile-meta.xml' },
      ])
      expect(plan.commentedOutWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given no commented-out driver lines, When planning install, Then commentedOutWarnings is empty', () => {
      // Arrange
      const pf = parse('*.profile-meta.xml merge=salesforce-source\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.commentedOutWarnings).toEqual([])
    })

    it('Given a commented-out driver for a pattern OUTSIDE the desired set, When planning install, Then no warning is emitted', () => {
      // Arrange — user kept a comment about a legacy glob we no longer
      // target. Not our business.
      const pf = parse('# *.old-meta.xml merge=salesforce-source\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.commentedOutWarnings).toEqual([])
    })

    it('Given a commented-out driver with extra whitespace after the #, When planning, Then the pattern is still detected', () => {
      // Regex guard — `/^\s*#\s*/` must strip the whitespace, not
      // reject the line for having extra spaces.
      const pf = parse('#    *.profile-meta.xml merge=salesforce-source\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.commentedOutWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given a commented-out driver line with trailing whitespace, When planning, Then the pattern is still detected (trimEnd must strip tail spaces)', () => {
      // Kills `trimEnd` → `trimStart` mutation. With `trimStart`
      // instead, trailing spaces survive and the suffix check
      // `endsWith(' merge=salesforce-source')` fails.
      const pf = parse('# *.profile-meta.xml merge=salesforce-source   \n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.commentedOutWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given a rule line whose raw happens to contain a # mid-line, When planning, Then it is NOT classified as a commented-out driver', () => {
      // Kills the regex anchor mutation `/\s*#\s*/` (no `^`). Without
      // the leading-anchor, `# merge=salesforce-source` anywhere in
      // the raw would match. We build such a case by planting the
      // suffix inside a fake comment whose # is NOT at the start.
      // Parser classifies this as a comment (starts with #), so we
      // instead use an actual rule whose pattern contains a # (rare
      // but possible per git attributes grammar).
      const pf = parse('*.p#fake merge=salesforce-source\n')

      // Act — desired set intentionally doesn't include the weird
      // pattern; we just need to prove the detector doesn't lift it.
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert — no commented-out warning (the line is a rule, not
      // a comment, so the detector shouldn't touch it).
      expect(plan.commentedOutWarnings).toEqual([])
    })

    it('Given a commented-out driver with NO space after the #, When planning, Then the pattern is still detected', () => {
      // Kills the regex mutation `/^\s*#\s/` (requires one space)
      // and `/^\s*#\S*/` (greedy non-space eats the pattern).
      const pf = parse('#*.profile-meta.xml merge=salesforce-source\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.commentedOutWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given a comment that happens to end with our suffix but the pattern has trailing whitespace, When planning, Then it is still matched (trim handles trailing spaces)', () => {
      // Kills the `body.slice(...).trim()` → `body.slice(...)` mutant.
      // Without trim, a pattern with a trailing space wouldn't be in
      // the desired set and the detection would silently drop it.
      const pf = parse('#    *.profile-meta.xml    merge=salesforce-source\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert — note: trailing whitespace is trimmed off BEFORE the
      // suffix check by trimEnd(), so the slice itself yields
      // '*.profile-meta.xml' already. The trim is belt-and-suspenders.
      expect(plan.commentedOutWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })
  })

  describe('-text footgun — glob marked binary', () => {
    it('Given one of our patterns has `-text` on a separate rule, When planning install, Then textAttributeWarnings is populated', () => {
      // Arrange — with `-text`, git treats the file as binary and
      // never invokes a merge driver, so our install would be silently
      // inactive. Surface it so the user can fix or confirm.
      const input = '*.profile-meta.xml -text\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.textAttributeWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given one of our patterns has `-text` combined with other attrs on the same line, When planning install, Then the warning still fires', () => {
      // Arrange
      const pf = parse('*.profile-meta.xml -text eol=lf\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.textAttributeWarnings).toEqual([
        { pattern: '*.profile-meta.xml', lineIndex: 0 },
      ])
    })

    it('Given a pattern with `text=auto` (set, not unset), When planning install, Then no `-text` warning is emitted', () => {
      // Arrange
      const pf = parse('*.profile-meta.xml text=auto\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert — `text=auto` is fine; only explicit `-text` (false) is
      // the footgun we warn about.
      expect(plan.textAttributeWarnings).toEqual([])
    })

    it('Given a `-text` rule on a pattern NOT in the desired set, When planning install, Then no warning is emitted', () => {
      // Arrange — we only care about patterns we plan to own.
      const pf = parse('*.bin -text\n')

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.textAttributeWarnings).toEqual([])
    })
  })

  describe('conflict policy — default is abort (backward compat)', () => {
    it('Given planInstall called without a policy argument, When planning a conflict, Then the `conflict` action is emitted (unchanged from step 3)', () => {
      // Arrange
      const input = '*.profile-meta.xml merge=some-other-tool\n'
      const pf = parse(input)

      // Act
      const plan = planInstall(pf, ['*.profile-meta.xml'])

      // Assert
      expect(plan.actions).toEqual([
        {
          kind: 'conflict',
          pattern: '*.profile-meta.xml',
          existingDriver: 'some-other-tool',
          lineIndex: 0,
        },
      ])
    })
  })
})

describe('GitAttributesPlanner.planUninstall — annotation-based restore', () => {
  it('Given an annotation comment above our driver line, When planning uninstall, Then action is `restore-overwrite` carrying the original raw and the annotation line is also dropped', () => {
    // Arrange — the shape that `overwrite` install produces
    const input =
      '# sf-git-merge-driver overwrote: *.profile-meta.xml merge=some-other-tool\n' +
      '*.profile-meta.xml merge=salesforce-source\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert — restore the captured original, and drop the annotation
    // comment that announced the overwrite.
    expect(plan.actions).toEqual([
      {
        kind: 'drop-line',
        lineIndex: 0,
      },
      {
        kind: 'restore-overwrite',
        lineIndex: 1,
        originalRaw: '*.profile-meta.xml merge=some-other-tool',
      },
    ])
  })

  it('Given an annotation comment NOT followed by one of our driver lines, When planning, Then the annotation is preserved (we did not write it)', () => {
    // Arrange — defensive: a user-typed comment happens to share our
    // prefix. We do not destroy it unless it sits directly above our
    // rule (the shape only install produces).
    const input =
      '# sf-git-merge-driver overwrote: just some random text\n' +
      '* text=auto\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert — no restore, no drop; nothing for the planner to do.
    expect(plan.actions).toEqual([])
  })

  it('Given an annotation with an empty body above our driver, When planning uninstall, Then NO restore is emitted and the driver rule falls through to drop-line (no crash)', () => {
    // Kills the empty-body crash: `parse("")` yields zero lines, so
    // writing `undefined` into the attributes file would corrupt it.
    // The planner ignores annotations whose body is empty / whitespace.
    const input =
      '# sf-git-merge-driver overwrote: \n' +
      '*.profile-meta.xml merge=salesforce-source\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert — the annotation is treated as an ordinary comment (no
    // action), the driver rule is dropped normally. The annotation
    // itself stays; user can remove it if they want.
    expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 1 }])
  })

  it('Given an annotation with a whitespace-only body, When planning uninstall, Then it is also treated as empty (no restore)', () => {
    const input =
      '# sf-git-merge-driver overwrote:    \n' +
      '*.profile-meta.xml merge=salesforce-source\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert
    expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 1 }])
  })

  it('Given our driver line at the very first file position (index 0, no prior line), When planning uninstall, Then it is treated as a plain drop-line (not a restore)', () => {
    // Kills the `i > 0 ? file.lines[i - 1] : undefined` mutants: if
    // that guard is removed, `file.lines[-1]` is undefined — same
    // observable result — but swapping `> 0` to `>= 0` would still
    // treat index 0 differently.
    const input = '*.profile-meta.xml merge=salesforce-source\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert — plain drop-line at index 0, not a restore-overwrite.
    expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 0 }])
  })

  it('Given a non-comment line directly above our driver rule, When planning, Then no restore-overwrite is emitted', () => {
    // Kills the `prev.kind === 'comment' && ...` → `true && ...` mutant.
    // Without the kind check, a rule line above ours whose raw happens
    // to start with our annotation prefix would incorrectly trigger a
    // restore. Here we use a rule whose raw cannot possibly match the
    // prefix (but the mutant would skip the kind check and try to
    // startsWith on any raw).
    const input =
      '*.other-meta.xml text=auto\n*.profile-meta.xml merge=salesforce-source\n'
    const pf = parse(input)

    // Act
    const plan = planUninstall(pf)

    // Assert — drop-line only, no restore; the preceding non-comment
    // rule line does not qualify as an annotation.
    expect(plan.actions).toEqual([{ kind: 'drop-line', lineIndex: 1 }])
  })
})
