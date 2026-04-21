export const setsEqual = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>
): boolean => {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

export const setsIntersect = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>
): boolean => {
  for (const item of a) {
    if (b.has(item)) return true
  }
  return false
}
