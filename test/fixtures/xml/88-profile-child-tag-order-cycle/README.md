# 88-profile-child-tag-order-cycle

A `Profile` carries a `fieldPermissions` entry, then `custom`, `description`
and `userLicense`. Ours moves `description` before `custom`, theirs moves
`userLicense` before `description`.

Over the three tags both sides moved, the pairwise orders form a cycle: ours
puts `description` before `custom`, theirs puts `userLicense` before
`description`, and both keep `custom` before `userLicense`. No order holds both
reorders, and the ancestor order would silently drop both.

At root level the type decides: the direct children of a metadata root element
follow a canonical order, `fullName` first and then code point order. The
three tags the cycle holds are written in that order, `custom`, `description`,
`userLicense`, where the block would have stood, and the merge has no conflict.
The untouched `fieldPermissions` entry stays ahead of them, where every side
agrees it stands.

Pins:
- A cycle among the pairwise orders of the root element's children resolves to
  the canonical order, with no conflict and no fallback to the ancestor order.
- Only the tags of the cycle are placed canonically: siblings no side moved
  keep their place.
- The same cycle in a nested element still conflicts: see fixture
  `90-nested-child-tag-order-cycle`.
