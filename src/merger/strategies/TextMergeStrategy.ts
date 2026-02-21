import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'

interface TextMergeStrategy {
  handle(
    config: MergeConfig,
    objAncestor: JsonObject,
    objLocal: JsonObject,
    objOther: JsonObject,
    ancestor: unknown,
    local: unknown,
    other: unknown
  ): MergeResult
}

class OtherOnlyStrategy implements TextMergeStrategy {
  handle(
    _config: MergeConfig,
    _objAncestor: JsonObject,
    _objLocal: JsonObject,
    objOther: JsonObject
  ): MergeResult {
    return noConflict([objOther])
  }
}

class LocalOnlyStrategy implements TextMergeStrategy {
  handle(
    _config: MergeConfig,
    _objAncestor: JsonObject,
    objLocal: JsonObject
  ): MergeResult {
    return noConflict([objLocal])
  }
}

class LocalAndOtherStrategy implements TextMergeStrategy {
  handle(
    config: MergeConfig,
    _objAncestor: JsonObject,
    objLocal: JsonObject,
    objOther: JsonObject,
    _ancestor: unknown,
    local: unknown,
    other: unknown
  ): MergeResult {
    if (local === other) {
      return noConflict([objLocal])
    }
    return withConflict(buildConflictMarkers(config, objLocal, {}, objOther))
  }
}

class AncestorAndOtherStrategy implements TextMergeStrategy {
  handle(
    config: MergeConfig,
    objAncestor: JsonObject,
    _objLocal: JsonObject,
    objOther: JsonObject,
    ancestor: unknown,
    _local: unknown,
    other: unknown
  ): MergeResult {
    if (ancestor !== other) {
      return withConflict(
        buildConflictMarkers(config, {}, objAncestor, objOther)
      )
    }
    return noConflict([])
  }
}

class AncestorAndLocalStrategy implements TextMergeStrategy {
  handle(
    config: MergeConfig,
    objAncestor: JsonObject,
    objLocal: JsonObject,
    _objOther: JsonObject,
    ancestor: unknown,
    local: unknown
  ): MergeResult {
    if (ancestor !== local) {
      return withConflict(
        buildConflictMarkers(config, objLocal, objAncestor, {})
      )
    }
    return noConflict([])
  }
}

class AllPresentStrategy implements TextMergeStrategy {
  handle(
    config: MergeConfig,
    objAncestor: JsonObject,
    objLocal: JsonObject,
    objOther: JsonObject,
    ancestor: unknown,
    local: unknown,
    other: unknown
  ): MergeResult {
    if (ancestor === local) {
      return noConflict([objOther])
    }
    if (ancestor === other) {
      return noConflict([objLocal])
    }
    if (local === other) {
      return noConflict([objLocal])
    }
    return withConflict(
      buildConflictMarkers(config, objLocal, objAncestor, objOther)
    )
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
