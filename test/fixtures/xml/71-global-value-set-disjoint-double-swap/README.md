# 71-global-value-set-disjoint-double-swap

Ours swaps Banking/Chemicals and Dairy/Energy inside a GlobalValueSet
`customValue` list; theirs swaps only Banking/Chemicals.

Before the fix the whole list was reported as one conflict.

Pins:
- A swap both sides agree on and a swap only one side made touch disjoint
  entries, so they merge cleanly: Chemicals, Banking, Energy, Dairy.
