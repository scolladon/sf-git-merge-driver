# 82-unkeyed-object-delete-vs-add-child

A CustomObject has a `nameField` with label `x` and type `Text`. Ours
deletes `nameField`, theirs adds a `trackHistory` child to it.

Deleting an element the other side extended is a conflict:
`<∅ | nameField{x,Text} | nameField{x,Text,trackHistory}>`.

Before this change the merge was clean and resurrected `nameField` with
only the `trackHistory` child.

Pins:
- One element-level block; the deleted element is not resurrected.
- Ours side is blank.
