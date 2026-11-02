# 63-keyed-keyless-entries-divergent-edits

A `Profile` carries two `fieldPermissions` without a `<field>` key. Ours
edits the first entry, theirs edits the second.

A keyless entry is identified by its content, so editing one is removing
the old content and adding the new. Ours removes the first entry, theirs
removes the second, and both add the same content: that content is one entry
added by both sides, so it appears once. The unrelated `<custom>` property is
untouched.

Pins:
- Keyless arrays merging through the ordered algorithm instead of a
  whole-array conflict.
- Identical additions from both sides collapsing into one entry.
