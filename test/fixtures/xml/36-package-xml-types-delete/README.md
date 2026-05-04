# 36-package-xml-types-delete

Companion regression for issue #191 covering deletion of an entire
`<types>` block.

- ancestor and theirs both contain two `<types>` blocks: `CustomObject`
  with `Account`, and `ApexClass` with `MyClass`+`OtherClass`.
- ours removes the entire `<types>name=ApexClass</types>` block,
  including its multi-`<members>` siblings.
- expected: the deletion is propagated. Only the `CustomObject` block
  remains.

Pins:
- `KeyedArrayMergeNode` keyed on `<name>` recognises that the
  `name=ApexClass` entry exists in ancestor+theirs but is absent in
  ours and treats it as a non-conflicting deletion.
- The writer never emits a stub `<types/>` block or leaks the deleted
  members into the surviving `CustomObject` block (no parser-shape
  cross-contamination between sibling wrapper-array entries).
