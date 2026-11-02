# 50-permissionset-incompatible-group-order-swapped

Merge-trio fixture pinning role symmetry on the root-level resolution of tags
both sides add in incompatible orders: swapping which side is `ours` and which
is `theirs` must not change the result.

Source: issue #203 — same scenario as
`49-permissionset-incompatible-group-order`, with `ours` and `theirs`
swapped.

Scenario: `ours` and `theirs` are exactly fixture 49's `theirs` and `ours`
respectively. Fixtures 47/48 already pin role symmetry on the path where a side
decides; this fixture pins it where the canonical order decides, which is where
an ours-biased implementation would most easily leak through.

Pins:
- `expected.xml` is byte-identical to fixture 49's: the canonical order does
  not depend on which side wrote what.
- No conflict: the two groups stand in canonical order whichever side is
  `ours`.
