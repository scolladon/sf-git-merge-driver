import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { jsonEqual } from '../../utils/jsonEqual.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'

interface TextMergeParams {
  readonly config: MergeConfig
  readonly attribute: string
  readonly ancestor: unknown
  readonly local: unknown
  readonly other: unknown
}

interface TextMergeStrategy {
  handle(params: TextMergeParams): MergeResult
}

// An attribute-bearing element reaches here as an object (see
// MergeNodeFactory.isAttributedTrio), and each side parses it into a
// distinct one, so values compare structurally. Scalars, the hot path,
// settle on identity alone and never pay jsonEqual's stack allocation.
const isSame = (a: unknown, b: unknown): boolean =>
  // Stryker disable next-line ConditionalExpression,LogicalOperator: the identity and object guards only skip jsonEqual, which returns the same answer for any pair they filter out
  a === b || (typeof a === 'object' && typeof b === 'object' && jsonEqual(a, b))

const asProperty = (attribute: string, value: unknown): JsonObject =>
  ({ [attribute]: value }) as JsonObject

class OtherOnlyStrategy implements TextMergeStrategy {
  handle({ attribute, other }: TextMergeParams): MergeResult {
    return noConflict([asProperty(attribute, other)])
  }
}

class LocalOnlyStrategy implements TextMergeStrategy {
  handle({ attribute, local }: TextMergeParams): MergeResult {
    return noConflict([asProperty(attribute, local)])
  }
}

class LocalAndOtherStrategy implements TextMergeStrategy {
  handle({ attribute, local, other }: TextMergeParams): MergeResult {
    if (isSame(local, other)) {
      return noConflict([asProperty(attribute, local)])
    }
    return withConflict([
      buildConflictMarkers(
        asProperty(attribute, local),
        {},
        asProperty(attribute, other)
      ),
    ])
  }
}

class AncestorAndOtherStrategy implements TextMergeStrategy {
  handle({ attribute, ancestor, other }: TextMergeParams): MergeResult {
    if (!isSame(ancestor, other)) {
      return withConflict([
        buildConflictMarkers(
          {},
          asProperty(attribute, ancestor),
          asProperty(attribute, other)
        ),
      ])
    }
    return noConflict([])
  }
}

class AncestorAndLocalStrategy implements TextMergeStrategy {
  handle({ attribute, ancestor, local }: TextMergeParams): MergeResult {
    if (!isSame(ancestor, local)) {
      return withConflict([
        buildConflictMarkers(
          asProperty(attribute, local),
          asProperty(attribute, ancestor),
          {}
        ),
      ])
    }
    return noConflict([])
  }
}

class AllPresentStrategy implements TextMergeStrategy {
  handle({ attribute, ancestor, local, other }: TextMergeParams): MergeResult {
    if (isSame(ancestor, local)) {
      return noConflict([asProperty(attribute, other)])
    }
    if (isSame(ancestor, other)) {
      return noConflict([asProperty(attribute, local)])
    }
    if (isSame(local, other)) {
      return noConflict([asProperty(attribute, local)])
    }
    return withConflict([
      buildConflictMarkers(
        asProperty(attribute, local),
        asProperty(attribute, ancestor),
        asProperty(attribute, other)
      ),
    ])
  }
}

class AncestorOnlyStrategy implements TextMergeStrategy {
  handle(): MergeResult {
    return noConflict([])
  }
}

class NoneStrategy implements TextMergeStrategy {
  handle(): MergeResult {
    return noConflict([])
  }
}

const strategies: Record<MergeScenario, TextMergeStrategy> = {
  [MergeScenario.NONE]: new NoneStrategy(),
  [MergeScenario.OTHER_ONLY]: new OtherOnlyStrategy(),
  [MergeScenario.LOCAL_ONLY]: new LocalOnlyStrategy(),
  [MergeScenario.LOCAL_AND_OTHER]: new LocalAndOtherStrategy(),
  [MergeScenario.ANCESTOR_AND_OTHER]: new AncestorAndOtherStrategy(),
  [MergeScenario.ANCESTOR_AND_LOCAL]: new AncestorAndLocalStrategy(),
  [MergeScenario.ALL]: new AllPresentStrategy(),
  [MergeScenario.ANCESTOR_ONLY]: new AncestorOnlyStrategy(),
}

export const getTextMergeStrategy = (
  scenario: MergeScenario
): TextMergeStrategy => {
  return strategies[scenario]
}
