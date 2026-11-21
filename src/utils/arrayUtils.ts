/**
 * Appends all elements from source arrays to target array.
 * Stack-safe alternative to target.push(...source) which can overflow on large arrays.
 */
export const pushAll = <T>(
  target: T[],
  ...sources: readonly (readonly T[])[]
): void => {
  for (const source of sources) {
    for (const item of source) {
      target.push(item)
    }
  }
}

/**
 * Math.min over the values without spreading them: a spread of one argument
 * per tied reading overflows the stack from about 100 000 readings.
 */
export const leastOf = (values: readonly number[]): number => {
  let least = Number.POSITIVE_INFINITY
  for (const value of values) least = Math.min(least, value)
  return least
}
