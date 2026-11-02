/**
 * Consumes the first item of an iterator that must have one; the rest stays
 * available to whoever keeps iterating.
 */
export const takeFirst = <T>(iterator: Iterator<T>): T => {
  const first = iterator.next()
  if (first.done) throw new Error('Expected an iterator with at least one item')
  return first.value
}
