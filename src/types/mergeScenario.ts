import { isEmpty } from 'lodash-es'

/**
 * Enum representing different merge scenarios based on content presence:
 * - First position: Ancestor content present (1) or absent (0)
 * - Second position: Ours content present (1) or absent (0)
 * - Third position: Theirs content present (1) or absent (0)
 */
export enum MergeScenario {
  NONE = 0, // No content in any source
  THEIRS_ONLY = 1, // Only theirs has content (001)
  OURS_ONLY = 10, // Only ours has content (010)
  OURS_AND_THEIRS = 11, // Both ours and theirs have content, no ancestor (011)
  ANCESTOR_ONLY = 100, // Only ancestor has content (100)
  ANCESTOR_AND_THEIRS = 101, // Ancestor and theirs have content, no ours (101)
  ANCESTOR_AND_OURS = 110, // Ancestor and ours have content, no theirs (110)
  ALL = 111, // All three sources have content (111)
}

export const getScenario = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ancestor: any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ours: any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  theirs: any
): MergeScenario => {
  let scenario: MergeScenario = MergeScenario.NONE
  if (!isEmpty(ancestor)) {
    scenario += 100
  }
  if (!isEmpty(ours)) {
    scenario += 10
  }
  if (!isEmpty(theirs)) {
    scenario += 1
  }
  return scenario
}
