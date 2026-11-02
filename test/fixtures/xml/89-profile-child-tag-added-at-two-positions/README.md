# 89-profile-child-tag-added-at-two-positions

A `Profile` carries a `fieldPermissions` entry, then `custom` and
`userLicense`. Ours adds `description` before `custom`, theirs adds it after
`userLicense`.

Both sides added the same tag, at positions that disagree: ours puts it ahead
of `custom` and `userLicense`, theirs behind them. The ancestor carries
`description` on neither side, so neither side inverted anything and nothing
in the files decides between the two places.

At root level the type decides: the direct children of a metadata root element
follow a canonical order, `fullName` first and then code point order. The tags
the block would have held (`description` and the tags between its two
positions) are written in that order in its place, and the merge has no
conflict. The untouched `fieldPermissions` entry stays ahead of them.

Pins:
- A tag both sides add at positions that disagree resolves to the canonical
  order at root level, with no conflict.
- The tags between the two positions move with it, so the block's span is
  written canonically, not the element.
- The same case in a nested element still conflicts: see fixture
  `91-nested-child-tag-added-at-two-positions`.
