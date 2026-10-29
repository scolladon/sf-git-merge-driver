# 69-global-value-set-same-reorder-both-sides

Ours and theirs both swap Chemicals and Banking inside a GlobalValueSet
`customValue` list.

Before the fix the merge kept only Banking and reported no conflict: the
Chemicals entry was silently dropped.

Pins:
- An entry present on all three sides survives when both sides move it identically.
