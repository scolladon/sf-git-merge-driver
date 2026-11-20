# 73-global-value-set-insert-vs-swap-conflict

Ours inserts Forestry between Banking and Chemicals; theirs swaps Banking
and Chemicals.

Before the fix the merge reported no conflict and silently wrote
`Chemicals, Banking, Forestry`.

Pins:
- An insertion whose neighbour the other side moved is a conflict covering
  every entry on the cycle:
  `<Banking, Forestry, Chemicals | Banking, Chemicals | Chemicals, Banking>`.
