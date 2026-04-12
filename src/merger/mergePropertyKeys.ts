import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

export const getUniqueSortedProps = (
  ...objects: (JsonObject | JsonArray)[]
): string[] => {
  const keys = new Set<string>()
  for (const obj of objects) {
    if (obj != null) {
      for (const key of Object.keys(obj)) keys.add(key)
    }
  }
  return [...keys].sort()
}
