# 70-global-value-set-reorder-vs-edit-and-delete

Ours swaps Chemicals and Dairy; theirs edits the Chemicals label and deletes
Dairy.

Before the fix the merge wrote no `customValue` at all and reported no
conflict: the edited Chemicals entry was silently dropped.

Pins:
- An entry edited on one side and reordered on the other is merged, not dropped.
- A deletion on one side still applies next to a reorder on the other.
