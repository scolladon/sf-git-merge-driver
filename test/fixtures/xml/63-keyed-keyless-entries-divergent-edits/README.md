# 63-keyed-keyless-entries-divergent-edits

A `Profile` carries two `fieldPermissions` without a `<field>` key. Ours
edits the first entry, theirs edits the second.

Before the fix both keyless entries collapsed onto one empty key and the
merge silently kept a single entry with a clean exit code. Once routed to
the unkeyed strategy, the conflict sides each rendered one
`<fieldPermissions>` holding all the children of every entry.

The array now conflicts, and each side of the conflict block lists every
entry as its own well-formed `<fieldPermissions>` element. The unrelated
`<custom>` property after the block merges cleanly.

Pins:
- The keyless fail-safe raising a conflict on divergent edits instead of
  dropping an entry.
- Per-entry rendering of the conflict sides.
