# 81-unkeyed-object-delete-vs-modify

A CustomObject has a `nameField` with label `x` and type `Text`. Ours
deletes `nameField`, theirs relabels it to `y`.

The deletion and the edit cannot both hold, so the whole element conflicts:
`<∅ | nameField{x,Text} | nameField{y,Text}>`. Keeping ours leaves no
`nameField`.

Before this change the conflict was per field with a blank ours, so keeping
ours left an empty `<nameField/>`.

Pins:
- One element-level block, not one block per child field.
- Ours side is blank.
