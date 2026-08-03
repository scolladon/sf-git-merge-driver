# 50-permissionset-incompatible-group-order-swapped

Merge-trio fixture pinning role symmetry on the cycle-repair path: swapping
which side is `ours` and which is `theirs` must not change the merged tag
order, even when the two sides disagree in a way that forms a rank cycle.

Source: issue #203 — same scenario as
`49-permissionset-incompatible-group-order`, with `ours` and `theirs`
swapped.

Scenario: `ours` and `theirs` are exactly fixture 49's `theirs` and `ours`
respectively. Fixtures 47/48 already pin role symmetry on the clean
(acyclic) path; this fixture pins it on the cycle path, where an
ours-biased implementation would most easily leak through, since fixture 49
alone only exercises the cycle repair in one direction.

Pins:
- `expected.xml` is byte-identical to
  `49-permissionset-incompatible-group-order/expected.xml`.
- The cycle tie-break (`<classAccesses>` before `<fieldPermissions>`) does
  not depend on which side is `ours` and which is `theirs`.
- No conflict markers.
