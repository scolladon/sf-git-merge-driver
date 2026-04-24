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
    // `instrumentedMerge` became async with the streaming pipeline
    // (parseStream + writeTo return promises). Awaiting here is load-
    // bearing: without it, the bench callback "finishes" before the
    // internal streams end, and vitest's fork pool times out on
    // teardown with "Timeout terminating forks worker" after the last
    // sample — even though every bench reported a result.
    bench(`merge-${size}-no-conflict`, async () => {
      const timer = new PhaseTimer()
      await instrumentedMerge(
        fixtures.ancestor,
        fixtures.local,
        fixtures.other,
        config,
        timer
      )
    })

    bench(`merge-${size}-with-conflict`, async () => {
      const timer = new PhaseTimer()
      await instrumentedMerge(
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

  bench('merge-ordered-globalvalueset', async () => {
    const timer = new PhaseTimer()
    await instrumentedMerge(
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

  bench('merge-picklist-customfield', async () => {
    const timer = new PhaseTimer()
    await instrumentedMerge(
      picklist.ancestor,
      picklist.local,
      picklist.other,
      config,
      timer
    )
  })
})
