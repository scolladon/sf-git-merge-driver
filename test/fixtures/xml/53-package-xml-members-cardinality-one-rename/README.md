# 53-package-xml-members-cardinality-one-rename

`<types>` has exactly one `<members>` entry on every side. Ours renames
it `Obj1` → `Y`, theirs renames the same original value `Obj1` → `Z`.

Before the fix, a `<types>` block with 2+ `<members>` already merged
this exact edit pattern as a set union (both renamed values survive, no
conflict — see `test/unit/merger/nodes/TextArrayMergeNode.test.ts`), but
at cardinality 1 the parser unboxes `<members>` to a bare scalar, so
`MergeNodeFactory.createNode`'s `isStringArray` check saw no array at
all and routed it through the strict, always-can-conflict
`TextMergeNode` instead — the same edit produced a real conflict purely
because of how many `<members>` happened to already be there.

`MetadataService.isTextArrayAttribute('members')` now forces the
set-semantics `TextArrayMergeNode` routing regardless of cardinality, so
this resolves the same way a 2+-member `<types>` block already did:
both renamed values kept, no conflict.

Pins:
- `MergeNodeFactory.createNode`'s forced routing for attributes listed
  in `MetadataService.isTextArrayAttribute`.
