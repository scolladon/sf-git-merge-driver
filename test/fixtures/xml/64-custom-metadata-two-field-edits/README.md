# 64-custom-metadata-two-field-edits

A custom metadata record holds three `<values>` entries (A string, B string,
C `xsi:nil`). Ours edits A's value, theirs edits B's value.

Before the fix the entries had no key, so the three entries were treated as
one undistinguishable group: A and B were lost and C was written three times,
with a clean exit code.

`values` is now keyed by `field` and merged unordered, and each `<value>` is
merged whole with its `xsi:type` / `xsi:nil` attribute. Both edits apply, C
keeps its `<value xsi:nil="true"/>`, entries stay in field order.

Pins:
- `values` keyed by `field` for CustomMetadata.
- Unordered strategy for CustomMetadata `values`.
- Attributed `<value>` merged as one value, attribute intact.
