import { NAMESPACE_ROOT } from '../constant/parserConstant.js'
import { isConflictBlock } from './conflictBlock.js'
import type { JsonValue } from './jsonTypes.js'

// How many document roots one top-level item of a merged tree opens: a
// conflict block occupies the root slot whole, an object opens one per tag
// (the namespace marker is no element), and a scalar opens none.
export const rootElementsIn = (item: JsonValue): number => {
  if (isConflictBlock(item)) return 1
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return 0
  }
  return Object.keys(item).filter(key => key !== NAMESPACE_ROOT).length
}
