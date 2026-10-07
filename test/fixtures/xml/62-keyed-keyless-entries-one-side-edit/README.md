# 62-keyed-keyless-entries-one-side-edit

A `Profile` carries two `fieldPermissions` without a `<field>` key. Ours
flips `editable` of the first entry; theirs only changes `<custom>`.

Before the fix both keyless entries collapsed onto the same empty key, the
last one won, and ours' edit to the first entry was lost with a clean exit
code.

Both entries are now kept in input order. The array is routed to the
unkeyed strategy, which takes ours' array as-is because theirs left it
unchanged, and theirs' `<custom>` edit merges.

Pins:
- `hasKeylessCollision` routing a keyed array with several keyless entries
  to the unkeyed strategy.
- The unkeyed strategy's one-side-changed fast path.
