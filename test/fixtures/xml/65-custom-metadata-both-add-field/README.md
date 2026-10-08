# 65-custom-metadata-both-add-field

Both sides add a new field to a custom metadata record: ours adds D
(`xsd:boolean`), theirs adds E (`xsd:double`).

Before the fix the merge ended in a conflict with four marker blocks, each
repeating the collapsed C entry.

Entries are now keyed by `field` and merged unordered, so concurrent
additions of distinct fields do not conflict. A to E come out in field
order and every `xsi:type` is intact.

Pins:
- Unordered routing for entries keyed by `field` (an ordered merge would
  conflict on concurrent additions).
- `xsi:type` round-trips on added entries.
