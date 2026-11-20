# 92-nested-child-tag-cycle-equal-content-keyed-entry

A `Profile` carries a `fieldPermissions` entry with `editable`, `field` and
`readable`. Ours moves `field` before `editable`, theirs moves `readable`
before `field`.

The three sides carry the same values: only the order of the entry's children
differs. Over the three tags, ours inverts `editable` and `field`, theirs
inverts `field` and `readable`, and both keep `editable` before `readable`.
That is a cycle (`field < editable < readable < field`) and no order holds both
reorders.

Only the direct children of the metadata root element have a canonical order.
The children of a `fieldPermissions` entry are nested, so the entry conflicts
as one block spanning the three tags, each side as written. The same cycle
among the root element's children merges clean: see fixture
`88-profile-child-tag-order-cycle`; the same cycle in a keyless nested element
conflicts too: see fixture `90-nested-child-tag-order-cycle`.

The entry is keyed, and its content is equal on every side. Equal content must
not stand for equal text: an entry that differs from the other side in tag
order alone still goes through the child-tag order merge, so the result does
not depend on which side is local.

Pins:
- A cycle among the child-tag orders of a keyed entry with equal content is a
  conflict, never ours' order.
- The block holds the three tags of the cycle; the untouched `custom` of the
  root element stays outside.
