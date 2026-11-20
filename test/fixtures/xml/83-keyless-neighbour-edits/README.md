# 83-keyless-neighbour-edits

A `Profile` carries two `fieldPermissions` without a `<field>` key. Ours
edits the first entry, theirs edits the second and the unrelated `<custom>`
property.

A keyless entry is identified by its content, so an edit removes the old
content and adds the new. Each addition replaces the entry its side removed
and takes that entry's place, so the two replacements of neighbouring
entries do not claim the same place: both edits are kept, in the order of the
entries they replaced.

Pins:
- A replacement keeping the place of what it replaced (ADR 071).
- Edits of neighbouring keyless entries on each side merging without conflict.
