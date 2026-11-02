import type { MergeConfig } from '../../types/conflictTypes.js'
import type { JsonArray, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { pushAll } from '../../utils/arrayUtils.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { MergeNode } from './MergeNode.js'

const COUNT_CONFLICT = 'conflict'
// One fixed collation: the machine's locale would order the same merge
// differently for each user
const VALUE_ORDER = new Intl.Collator('en')

export interface ValueCounts {
  readonly ancestor: number
  readonly local: number
  readonly other: number
}

type Side = keyof ValueCounts
type Tally = { -readonly [S in Side]: number }

interface Counted extends Tally {
  readonly value: JsonValue
  readonly comparable: string
}

// Total coercion, independent of Object.prototype.toString: the parser
// builds compact nodes on Object.create(null) (prototype-pollution guard),
// so an object item reaching this comparator has no inherited toString —
// String(obj) would throw. JSON.stringify needs no prototype method, and
// agrees with String on null ("null"), so null needs no separate arm.
const toComparable = (value: JsonValue): string =>
  typeof value === 'object' ? JSON.stringify(value) : String(value)

// Typed identity: the type prefix keeps 1 and "1" apart, JSON.stringify
// keeps equal structures together and agrees with itself on null.
const identityOf = (value: JsonValue): string =>
  `${typeof value}${JSON.stringify(value)}`

const countSides = (sides: Record<Side, JsonArray>): Counted[] => {
  const slots = new Map<string, Counted>()
  for (const side of Object.keys(sides) as Side[]) {
    for (const value of sides[side]) {
      const id = identityOf(value)
      const slot = slots.get(id) ?? {
        value,
        comparable: toComparable(value),
        ancestor: 0,
        local: 0,
        other: 0,
      }
      slot[side]++
      slots.set(id, slot)
    }
  }
  return [...slots.values()]
}

// Copies of one value are interchangeable, so every identity reading reduces
// to counts: each side keeps min(side, ancestor) copies and the survivors may
// range over [low, high]; the readings agree iff that range is one number.
// A side equal to the ancestor needs no arm: the range is then the other
// side's kept copies alone, so the formula already returns the other side.
export const mergedCount = ({
  ancestor,
  local,
  other,
}: ValueCounts): number | typeof COUNT_CONFLICT => {
  if (local === other) return local
  const keptLocal = Math.min(local, ancestor)
  const keptOther = Math.min(other, ancestor)
  const low = Math.max(0, keptLocal + keptOther - ancestor)
  const high = Math.min(keptLocal, keptOther)
  if (low !== high) return COUNT_CONFLICT
  return high + Math.max(local - keptLocal, other - keptOther)
}

export class TextArrayMergeNode implements MergeNode {
  constructor(
    private readonly ancestor: JsonArray,
    private readonly local: JsonArray,
    private readonly other: JsonArray,
    private readonly attribute: string
  ) {}

  merge(_config: MergeConfig): MergeResult {
    const counted = countSides({
      ancestor: this.ancestor,
      local: this.local,
      other: this.other,
    }).sort((a, b) => VALUE_ORDER.compare(a.comparable, b.comparable))
    const output: JsonArray = []
    let hasConflict = false
    for (const entry of counted) {
      const count = mergedCount(entry)
      if (count === COUNT_CONFLICT) {
        hasConflict = true
        output.push(this.conflictBlock(entry))
        continue
      }
      pushAll(output, this.copies(entry.value, count))
    }
    return { output, hasConflict }
  }

  private copies(value: JsonValue, count: number): JsonArray {
    return Array.from({ length: count }, () =>
      value == null ? {} : { [this.attribute]: value }
    )
  }

  private conflictBlock(entry: Counted): JsonValue {
    return buildConflictMarkers(
      this.copies(entry.value, entry.local),
      this.copies(entry.value, entry.ancestor),
      this.copies(entry.value, entry.other)
    )
  }
}
