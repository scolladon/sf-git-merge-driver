# 93-delete-entry-vs-reorder-its-child-tags

A `Profile` carries two `fieldPermissions` entries. Ours deletes the
`Account.Rating` entry. Theirs keeps it with the same values and moves `field`
ahead of `editable`.

A reorder is a change, like an edit: the engine cannot tell whether the
deletion or the reorder is right, so the entry is one conflict block, ours
empty, theirs as written. The untouched `Account.Name` entry stays outside.

Pins:
- A deletion does not silently win against a reorder of the entry's child tags.
- The block holds the whole entry, as for delete vs modify.
- The same holds for ordered keyed entries and for keyless elements.
