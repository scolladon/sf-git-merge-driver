import { bench, describe } from 'vitest'
import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../src/constant/conflictConstant.js'
import type { MergeConfig } from '../../src/types/conflictTypes.js'
import {
  generateOrderedFixtures,
  generatePicklistFixtures,
  generateProfileFixtures,
} from './fixtures/generateFixtures.js'
import { instrumentedMerge } from './instrumentation/instrumentedMerge.js'
import { PhaseTimer } from './instrumentation/PhaseTimer.js'

const config: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const fixtures = generateProfileFixtures(size)

  describe(`merge-${size}`, () => {
    bench(`merge-${size}-no-conflict`, () => {
      const timer = new PhaseTimer()
      instrumentedMerge(
        fixtures.ancestor,
        fixtures.local,
        fixtures.other,
        config,
        timer
      )
    })

    bench(`merge-${size}-with-conflict`, () => {
      const timer = new PhaseTimer()
      instrumentedMerge(
        fixtures.ancestor,
        fixtures.conflictLocal,
        fixtures.conflictOther,
        config,
        timer
      )
    })
  })
}

describe('merge-ordered', () => {
  const ordered = generateOrderedFixtures()

  bench('merge-ordered-globalvalueset', () => {
    const timer = new PhaseTimer()
    instrumentedMerge(
      ordered.ancestor,
      ordered.local,
      ordered.other,
      config,
      timer
    )
  })
})

describe('merge-picklist', () => {
  const picklist = generatePicklistFixtures()

  bench('merge-picklist-customfield', () => {
    const timer = new PhaseTimer()
    instrumentedMerge(
      picklist.ancestor,
      picklist.local,
      picklist.other,
      config,
      timer
    )
  })
})
