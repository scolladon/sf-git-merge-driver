# 87-nested-unordered-reorder-vs-entry-delete

A `Workflow` alert carries two `recipients`. Ours only reorders them, theirs
deletes the alert.

`recipients` is unordered, so ours left the alert unchanged and the deletion is
taken without conflict. Deleting an alert that was really edited stays a
conflict (see `80-keyed-delete-vs-modify`).

Pins:
- The unchanged test of delete versus modify reads an entry with the type's
  equality, not by position (ADR 072).
