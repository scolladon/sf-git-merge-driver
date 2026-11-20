# 62-keyed-keyless-entries-one-side-edit

A `Profile` carries two `fieldPermissions` without a `<field>` key. Ours
flips `editable` of the first entry; theirs only changes `<custom>`.

Before the fix both keyless entries were given the same key, the string
`"undefined"`; the last one won, and ours' edit to the first entry was lost with a clean exit
code.

Both entries are now kept in input order. The array is routed to the
ordered strategy, each keyless entry identified by its content, which keeps ours' edit because
theirs left the array unchanged, and theirs' `<custom>` edit merges.

Pins:
- `toSideKeys` routing a keyed array with keyless entries
  to the ordered strategy.
- The ordered strategy's one-side-changed path.
