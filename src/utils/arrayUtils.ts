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

export const hasSameOrder = (
  a: readonly string[],
  b: readonly string[]
): boolean => {
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

export const lcs = (a: readonly string[], b: readonly string[]): string[] => {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return []

  // Flat Int32Array is ~2× faster to allocate than number[][] and avoids the
  // per-row array allocations (and their GC pressure) on large inputs.
  const stride = n + 1
  const dp = new Int32Array((m + 1) * stride)

  for (let i = 1; i <= m; i++) {
    const rowPrev = (i - 1) * stride
    const rowCurr = i * stride
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[rowCurr + j] = dp[rowPrev + (j - 1)] + 1
      } else {
        const up = dp[rowPrev + j]
        const left = dp[rowCurr + (j - 1)]
        dp[rowCurr + j] = up >= left ? up : left
      }
    }
  }

  const result: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push(a[i - 1])
      i--
      j--
    } else if (dp[(i - 1) * stride + j] > dp[i * stride + (j - 1)]) {
      i--
    } else {
      j--
    }
  }
  result.reverse()
  return result
}
