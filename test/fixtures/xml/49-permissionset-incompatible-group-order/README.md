# 49-permissionset-incompatible-group-order

Merge-trio fixture pinning the tie-break rule for tag groups both sides
introduce in mutually incompatible relative orders.

Source: issue #203 — both `ours` and `theirs` add `<fieldPermissions>` and
`<classAccesses>` (identical content on both sides) but in opposite relative
order, so no first-seen position can satisfy both sides. Git itself raises a
conflict on this input; the driver deliberately resolves it instead, because
tag order carries no conflict channel and raising one here would change
*whether* a conflict fires, not just how the tags are laid out.

Scenario: `ours` orders the new groups `fieldPermissions` then
`classAccesses`; `theirs` orders them `classAccesses` then `fieldPermissions`.
Neither side's ordering can win outright, so the two tag names are sorted
alphabetically among themselves: `classAccesses` before `fieldPermissions`.

**Caution:** with only two cycle members, the alphabetical answer happens to
coincide with `theirs`' sequence. This is coincidence, not the rule — the rule
is "alphabetical **among the members of the cycle**", never "theirs wins".
The unit suite's three-tag cycle row is the unambiguous pin for that
distinction. Alphabetical order applies **only** to keys the three input
sequences leave mutually unordered; every tag whose position any side
determines keeps its first-seen position.

Pins:
- `<classAccesses>` before `<fieldPermissions>` in the merged output — the
  alphabetical tie-break among cycle members.
- `<description>` and `<tabSettings>` keep their ancestor-determined
  positions, unaffected by the cycle.
- No conflict markers — the tie-break resolves the cycle without surfacing a
  conflict block.
