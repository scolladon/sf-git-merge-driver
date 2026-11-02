# 70-global-value-set-reorder-vs-edit-and-delete

Ours swaps Chemicals and Dairy; theirs edits the Chemicals label and deletes
Dairy.

Dairy is deleted by theirs and possibly moved by ours, so it conflicts:
`<Dairy | Dairy | ∅>`. The edited Chemicals entry is kept after it.

Before the fix the merge wrote no `customValue` at all and reported no
conflict: the edited Chemicals entry was silently dropped.

Pins:
- A deletion on one side against a move on the other is a conflict, and it
  covers that entry only.
- An entry edited on one side and reordered on the other is merged, not dropped.
