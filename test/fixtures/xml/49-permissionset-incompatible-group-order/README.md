# 49-permissionset-incompatible-group-order

Merge-trio fixture pinning how the root element settles tags both sides
introduce in mutually incompatible relative orders.

Source: issue #203 — both `ours` and `theirs` add `<fieldPermissions>` and
`<classAccesses>` (identical content on both sides) but in opposite relative
order, so no first-seen position can satisfy both sides.

Scenario: `ours` orders the new groups `fieldPermissions` then
`classAccesses`; `theirs` orders them `classAccesses` then `fieldPermissions`.
The ancestor carries neither, so neither side inverted anything: the two
orders contradict each other and nothing in the files decides between them.

The direct children of a metadata root element have a canonical order: the
type decides, not the files. `fullName` comes first, then the tags in code
point order (a retrieve writes them that way). A contradiction at root level
therefore resolves without a conflict: the tags the conflict block would have
held are written in its place in canonical order, and each tag's content merges
as usual. The canonical order only replaces what would have been a block; it
never overrides a side that reordered on its own.

Pins:
- No conflict: `classAccesses` then `fieldPermissions`, the canonical order,
  which neither `ours` nor `theirs` wrote in both positions.
- `<description>` and `<tabSettings>`, which every side agrees on, keep their
  places around the two groups.
- The nested level keeps the conflict: see fixtures
  `90-nested-child-tag-order-cycle` and
  `91-nested-child-tag-added-at-two-positions`.
