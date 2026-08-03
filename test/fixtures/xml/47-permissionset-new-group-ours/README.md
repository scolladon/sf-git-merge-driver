# 47-permissionset-new-group-ours

Merge-trio fixture pinning three-way XML tag order when one side introduces a
new tag group.

Source: issue #203 — a `PermissionSet` merge that concatenated `<classAccesses>`
after every existing group instead of placing it where the introducing side put
it, and lost `<tabSettings>` additions from the other side in the process.

Scenario: `ours` inserts a new `<classAccesses>` group between the existing
`<description>` and `<tabSettings>` entries; `theirs` adds a second
`<tabSettings>` entry (`Contact`) without touching `<classAccesses>`. Both
changes are independent and the merge is clean — no conflict.

Pins:
- `<classAccesses>`, introduced only by `ours`, keeps `ours`' position: after
  `<description>` and before `<tabSettings>`.
- Both `<tabSettings>` entries (`Account`, `Contact`) are present; `tabSettings`
  is keyed by `tab` (MetadataService.ts).
- No conflict markers — the outcome is forced by precedence edges from the
  ancestor, so it does not depend on the tie-break rank.
