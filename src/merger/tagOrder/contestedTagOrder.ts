// What becomes of child tags the sides order against each other: a tag both
// add at positions that disagree, or a cycle among their reorders.
export enum ContestedTagOrder {
  // Nothing decides: the tags conflict as one block, each side as written.
  CONFLICT = 'conflict',
  // The type decides: the tags stand in canonical order, which holds for the
  // direct children of a metadata root element and for no other element.
  CANONICAL = 'canonical',
}

const LEADING_TAG = 'fullName'

// The tags of an element are distinct, so two of them are never equal
const compareCanonically = (left: string, right: string): number => {
  if (left === LEADING_TAG) return -1
  if (right === LEADING_TAG) return 1
  // Stryker disable next-line EqualityOperator: the tags of an element are distinct, so left === right never happens
  return left < right ? -1 : 1
}

// `fullName` first, then code point order: plain `<`, never `localeCompare`,
// so the bytes written do not depend on the host's locale.
export const inCanonicalOrder = (tags: readonly string[]): string[] =>
  [...tags].sort(compareCanonically)
