import { describe, expect, it } from 'vitest'
import {
  planUninstall,
  type UninstallPlan,
} from '../../../src/service/GitAttributesPlanner.js'
import {
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
