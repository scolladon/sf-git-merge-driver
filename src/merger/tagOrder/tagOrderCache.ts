import type { ContestedTagOrder } from './contestedTagOrder.js'
import type { PropertyOrder } from './mergePropertyOrder.js'

// Entries of one array often carry the same tags in the same orders on every
// side, and the order merge depends on nothing but those sequences and the
// policy. The key is a JSON encoding, so any character a tag name may hold
// stays unambiguous. The cache belongs to one orchestrator, and what it hands
// out is only read.
const MAX_CACHED_ORDERS = 1024

const keyOf = (
  policy: ContestedTagOrder,
  sequences: readonly (readonly string[])[]
): string => JSON.stringify([policy, ...sequences])

export class TagOrderCache {
  private readonly orders = new Map<string, PropertyOrder>()

  orderOf(
    policy: ContestedTagOrder,
    sequences: readonly (readonly string[])[],
    compute: () => PropertyOrder
  ): PropertyOrder {
    const key = keyOf(policy, sequences)
    const known = this.orders.get(key)
    if (known !== undefined) return known
    const order = compute()
    if (this.orders.size < MAX_CACHED_ORDERS) this.orders.set(key, order)
    return order
  }
}
