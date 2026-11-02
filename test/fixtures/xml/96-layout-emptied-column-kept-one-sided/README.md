# 96-layout-emptied-column-kept-one-sided

A `Layout` section holds one column with one item. Ours empties the column to
`<layoutColumns/>`; theirs leaves it unchanged.

An empty element is a value of its own, distinct from an absent one. Only ours
changed it, so its change is kept: the column stays as `<layoutColumns/>`
instead of vanishing from the section.

Pins:
- An element emptied on one side is kept as an empty element.
- A change between an element and an empty element is a change of the whole value.
