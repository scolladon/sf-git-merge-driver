# 01-root-ns

Basic three-way merge of a Profile with root-level `xmlns`. Ancestor has
one `userPermissions`; ours adds `ModifyAllData`, theirs adds
`ApiEnabled`. Expected result is both additions merged, alphabetically
keyed, no conflict.

Pins:
- Namespace emission on root element (`xmlns="..."`).
- Keyed-array merge on `userPermissions` (`name` is the key).
- No conflict-marker path.
