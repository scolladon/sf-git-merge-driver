# 91-nested-child-tag-added-at-two-positions

A `Profile` carries a `fieldPermissions` entry with `field` and `readable`.
Ours adds `editable` before `field` (and turns `readable` off), theirs adds
`editable` after `readable`.

Both sides added the same tag, at positions that disagree, and the ancestor
carries it on neither side: nothing in the files decides between the two
places.

Only the direct children of the metadata root element have a canonical order.
The children of a `fieldPermissions` entry are nested, and no rule holds there,
so the entry conflicts as one block spanning `editable` and the tags between
its two positions, each side as written. The same tag added at two positions
among the root element's children merges clean: see fixture
`89-profile-child-tag-added-at-two-positions`.

Ours also changes `readable`, so the two entries differ in content and not only
in order. An entry that differs in order alone conflicts the same way: see
fixture `92-nested-child-tag-cycle-equal-content-keyed-entry`.

Pins:
- A tag both sides add at positions that disagree is a conflict inside a nested
  element, as a cycle among reorders is.
- The block is the entry's contested span; the untouched `custom` of the root
  element stays outside.
