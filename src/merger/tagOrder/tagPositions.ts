export const ABSENT = -1

// Position of each tag, by tag number, in a sequence of tag numbers
export const positionsOf = (
  sequence: readonly number[],
  tagCount: number
): number[] => {
  const positions = new Array<number>(tagCount).fill(ABSENT)
  // Stryker disable next-line EqualityOperator: position sequence.length writes a non-index property, never read
  for (let position = 0; position < sequence.length; position++) {
    positions[sequence[position]] = position
  }
  return positions
}
