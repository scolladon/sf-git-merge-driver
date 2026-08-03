# 48-permissionset-new-group-theirs

Merge-trio fixture pinning role symmetry: swapping which side is `ours` and
which is `theirs` must not change the merged tag order.

Source: issue #203 — same scenario as
`47-permissionset-new-group-ours`, with `ours` and `theirs` swapped.

Scenario: `ours` and `theirs` are exactly fixture 47's `theirs` and `ours`
respectively — `ours` adds the second `<tabSettings>` entry (`Contact`),
`theirs` inserts the new `<classAccesses>` group. A `git merge` and the
`git rebase` that swaps the same two branches must produce identical layout,
so `expected.xml` is byte-identical to fixture 47's — any difference between
the two would be a bug.

Pins:
- `expected.xml` is byte-identical to
  `47-permissionset-new-group-ours/expected.xml`.
- `<classAccesses>` keeps its introducing side's position regardless of
  whether that side is `ours` or `theirs`.
- No conflict markers.
