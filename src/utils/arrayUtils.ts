/**
 * Appends all elements from source arrays to target array.
 * Stack-safe alternative to target.push(...source) which can overflow on large arrays.
 */
export const pushAll = <T>(target: T[], ...sources: T[][]): void => {
  for (const source of sources) {
    for (const item of source) {
      target.push(item)
    }
  }
}

export const hasSameOrder = (a: string[], b: string[]): boolean => {
  const bSet = new Set(b)
  const aFiltered = a.filter(k => bSet.has(k))
  const aSet = new Set(a)
  const bFiltered = b.filter(k => aSet.has(k))
  if (aFiltered.length !== bFiltered.length) return false
  for (let i = 0; i < aFiltered.length; i++) {
    if (aFiltered[i] !== bFiltered[i]) return false
  }
  return true
}

const DIR_TOP = 0
const DIR_LEFT = 1
const DIR_DIAG = 2

export const lcs = (a: string[], b: string[]): string[] => {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return []

  let prev = new Array<number>(n + 1).fill(0)
  let curr = new Array<number>(n + 1).fill(0)
  const dir: Uint8Array[] = Array.from(
    { length: m + 1 },
    () => new Uint8Array(n + 1)
  )

  for (let i = 1; i <= m; i++) {
    curr[0] = 0
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
        dir[i][j] = DIR_DIAG
      } else if (prev[j] > curr[j - 1]) {
        curr[j] = prev[j]
        dir[i][j] = DIR_TOP
      } else {
        curr[j] = curr[j - 1]
        dir[i][j] = DIR_LEFT
      }
    }
    ;[prev, curr] = [curr, prev]
  }

  const result: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (dir[i][j] === DIR_DIAG) {
      result.push(a[i - 1])
      i--
      j--
    } else if (dir[i][j] === DIR_TOP) {
      i--
    } else {
      j--
    }
  }
  result.reverse()
  return result
}
