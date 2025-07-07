import { isEmpty } from 'lodash-es'

/**
 * Enum representing different merge scenarios based on content presence:
 * - First position: Ancestor content present (1) or absent (0)
 * - Second position: local content present (1) or absent (0)
 * - Third position: other content present (1) or absent (0)
 */
export enum MergeScenario {
  NONE = 0, // No content in any source
  OTHER_ONLY = 1, // Only other has content (001)
  LOCAL_ONLY = 10, // Only local has content (010)
  LOCAL_AND_OTHER = 11, // Both local and other have content, no ancestor (011)
  ANCESTOR_ONLY = 100, // Only ancestor has content (100)
  ANCESTOR_AND_OTHER = 101, // Ancestor and other have content, no local (101)
  ANCESTOR_AND_LOCAL = 110, // Ancestor and local have content, no other (110)
  ALL = 111, // All three sources have content (111)
}

export const getScenario = (
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  ancestor: any,
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  local: any,
  // biome-ignore lint/suspicious/noExplicitAny: can be any metadata in json format
  other: any
): MergeScenario => {
  let scenario: MergeScenario = MergeScenario.NONE
  if (!isEmpty(ancestor)) {
    scenario += 100
  }
  if (!isEmpty(local)) {
    scenario += 10
  }
  if (!isEmpty(other)) {
    scenario += 1
  }
  return scenario
}
