# 35-package-xml-members-delete

Companion regression for issue #191 covering deletion of a single
`<members>` entry from an existing `<types>` block.

- ancestor and theirs both keep `MyClass` and `OtherClass` under
  `<types>name=ApexClass</types>`.
- ours deletes `OtherClass` while leaving `MyClass`.
- expected: the deletion is propagated. `ApexClass` keeps only
  `MyClass`. `CustomObject` is untouched on every side.

Pins:
- The writer's multi-key wrapper iteration unfolds the surviving
  `members: [...]` parser-shape array correctly when one entry has
  been removed (no concatenation, no spurious empty `<members/>`).
- `KeyedArrayMergeNode` keyed on `name=ApexClass` matches across
  branches and accepts the unkeyed `<members>` deletion as a
  non-conflicting change.
- Observed ordering: the modified `ApexClass` block emerges first
  in the output, ahead of the unchanged `CustomObject` block. This
  pins the current `KeyedArrayMergeNode` behaviour where keyed
  entries that received a child-level change surface before
  unchanged siblings; revisit if the ordering policy changes.
