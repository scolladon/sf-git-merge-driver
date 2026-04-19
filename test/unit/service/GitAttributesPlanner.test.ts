import { describe, expect, it } from 'vitest'
import {
  type InstallPlan,
  planInstall,
  planUninstall,
  type UninstallPlan,
} from '../../../src/service/GitAttributesPlanner.js'
import {
  addRule,
  parse,
  ruleWithoutAttr,
  serialise,
} from '../../../src/utils/gitAttributesFile.js'

/**
 * planUninstall maps a parsed `.git/info/attributes` to a list of actions
 * that cleanly remove the driver's presence while preserving any user
 * attributes that happen to share the same line. Both the plan itself
 * and the serialised result of applying it are asserted, because the
 * plan is also what `--dry-run` will show to users.
 */

const applyPlan = (input: string, plan: UninstallPlan): string => {
  const parsed = parse(input)
  const actionByIndex = new Map(plan.actions.map(a => [a.lineIndex, a]))
  const kept = parsed.lines.flatMap((line, index) => {
    const action = actionByIndex.get(index)
    if (!action) return [line]
    if (action.kind === 'drop-line') return []
    // remove-merge-attr — reuse the shared helper so the test mirrors
    // what UninstallService actually does.
    if (line.kind !== 'rule') return [line]
    return [ruleWithoutAttr(line, 'merge')]
  })
  return serialise({ ...parsed, lines: kept })
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
 * another tool. The planner is pure domain — no I/O, no policy
 * enforcement; the service reads the plan and chooses how to apply.
 */
const applyInstallPlan = (
  input: string,
  patterns: readonly string[],
  plan: InstallPlan
): string => {
  const parsed = parse(input)
  const dedup = new Set(plan.dedupDrops)
  const kept = parsed.lines.flatMap((line, index) =>
    dedup.has(index) ? [] : [line]
  )
  let next = { ...parsed, lines: kept }
  for (const action of plan.actions) {
    if (action.kind !== 'add') continue
    // Derived via the shared helper so the test matches the service
    next = addRule(next, action.pattern, [['merge', 'salesforce-source']])
  }
  // `patterns` is accepted for symmetry with the service API but not
  // used here — the plan already contains resolved actions.
  void patterns
  return serialise(next)
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
      const applied = applyInstallPlan(input, ['*.profile-meta.xml'], plan)
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
      const applied = applyInstallPlan(input, ['*.profile-meta.xml'], plan)
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
      const applied = applyInstallPlan(input, ['*.profile-meta.xml'], plan)
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
})
